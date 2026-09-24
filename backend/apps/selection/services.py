"""Domain services for Selection & Assessment (F9)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.db import models, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.admission.models import AdmissionPeriod, Application, ApplicationStatus
from apps.admission.services import ApplicantService, ApplicationStateMachineService
from apps.selection.models import (
    ApplicationDecision,
    ApplicationDecisionType,
    ApplicationScore,
    Assessment,
    AssessmentSchedule,
    AssessmentScheduleStatus,
    DecisionHistory,
    SelectionComponent,
    WaitingListEntry,
    WaitingListStatus,
)


class SelectionComponentService:
    """Service governing SelectionComponent configuration and weight validation."""

    @classmethod
    def list_for_period(
        cls, period_id: uuid.UUID | None = None
    ) -> models.QuerySet[SelectionComponent]:
        queryset = SelectionComponent.objects.filter(is_active=True)
        if period_id:
            queryset = queryset.filter(admission_period_id=period_id)
        return queryset.order_by("sort_order", "name")

    @classmethod
    @transaction.atomic
    def create(cls, validated_data: dict[str, Any]) -> SelectionComponent:
        period_id = validated_data.pop("admission_period_id")
        try:
            period = AdmissionPeriod.objects.get(pk=period_id)
        except AdmissionPeriod.DoesNotExist as exc:
            raise NotFound({"admission_period_id": "Admission period not found."}) from exc

        code = validated_data.get("code")
        if SelectionComponent.objects.filter(admission_period=period, code__iexact=code).exists():
            raise ValidationError(
                {"code": f"Selection component with code '{code}' already exists for this period."}
            )

        component = SelectionComponent.objects.create(admission_period=period, **validated_data)
        cls.validate_period_weights(period.id)
        return component

    @classmethod
    @transaction.atomic
    def update(
        cls, instance: SelectionComponent, validated_data: dict[str, Any]
    ) -> SelectionComponent:
        new_code = validated_data.get("code")
        if new_code and new_code != instance.code:
            if (
                SelectionComponent.objects.filter(
                    admission_period=instance.admission_period, code__iexact=new_code
                )
                .exclude(pk=instance.pk)
                .exists()
            ):
                raise ValidationError(
                    {"code": f"Selection component code '{new_code}' already exists."}
                )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        cls.validate_period_weights(instance.admission_period_id)
        return instance

    @classmethod
    def delete(cls, instance: SelectionComponent) -> None:
        if instance.assessments.exists() or instance.schedules.exists():
            instance.is_active = False
            instance.save()
        else:
            instance.delete()

    @classmethod
    def validate_period_weights(cls, period_id: uuid.UUID) -> Decimal:
        components = SelectionComponent.objects.filter(
            admission_period_id=period_id, is_active=True
        )
        total_weight = sum((comp.weight for comp in components), Decimal("0.00"))

        if total_weight > Decimal("100.00"):
            raise ValidationError(
                {"weight": f"Total weight of active components ({total_weight}%) exceeds 100%."}
            )
        return total_weight


class AssessmentScheduleService:
    """Service governing scheduling candidates for assessment components."""

    @classmethod
    @transaction.atomic
    def create_schedule(
        cls,
        user: Any,
        application_id: uuid.UUID,
        component_id: uuid.UUID,
        scheduled_at: Any,
        location: str | None = None,
        room: str | None = None,
        notes: str | None = None,
    ) -> AssessmentSchedule:
        try:
            application = Application.objects.select_related("admission_period").get(
                pk=application_id
            )
        except Application.DoesNotExist as exc:
            raise NotFound({"application_id": "Application not found."}) from exc

        try:
            component = SelectionComponent.objects.get(
                pk=component_id, admission_period=application.admission_period, is_active=True
            )
        except SelectionComponent.DoesNotExist as exc:
            raise NotFound(
                {"component_id": "Selection component not found for this period."}
            ) from exc

        schedule = AssessmentSchedule.objects.create(
            application=application,
            component=component,
            scheduled_at=scheduled_at,
            location=location,
            room=room,
            notes=notes,
            status=AssessmentScheduleStatus.SCHEDULED,
        )

        if application.status == ApplicationStatus.VERIFIED:
            ApplicationStateMachineService.transition(
                user=user,
                application=application,
                to_status=ApplicationStatus.ASSESSMENT_SCHEDULED,
                reason=f"Assessment scheduled for component '{component.name}'.",
            )

        return schedule


class ScoreCalculationService:
    """Central weighted score calculator using precise Decimal arithmetic."""

    @classmethod
    def calculate_application_score(cls, application: Application) -> ApplicationScore:
        assessments = list(
            Assessment.objects.filter(application=application).select_related("component")
        )

        raw_score = sum((a.score for a in assessments), Decimal("0.0000"))
        final_score = sum(
            (a.weighted_score or Decimal("0.0000") for a in assessments), Decimal("0.0000")
        )

        app_score, _ = ApplicationScore.objects.update_or_create(
            application=application,
            defaults={
                "raw_score": raw_score,
                "final_score": final_score,
            },
        )
        return app_score


class AssessmentService:
    """Service governing assessor score input, validation, and completion status."""

    @classmethod
    @transaction.atomic
    def input_score(
        cls,
        user: Any,
        application_id: uuid.UUID,
        component_id: uuid.UUID,
        score: Decimal,
        notes: str | None = None,
    ) -> Assessment:
        has_perm = getattr(user, "has_any_perm_codes", None)
        perm_codes = ["assessment.input", "assessment.approve", "application.override"]
        if not (callable(has_perm) and user.has_any_perm_codes(perm_codes)):
            raise PermissionDenied(
                {"detail": "You do not have permission to input assessment scores."}
            )

        try:
            application = Application.objects.select_related("admission_period").get(
                pk=application_id
            )
        except Application.DoesNotExist as exc:
            raise NotFound({"detail": "Application not found."}) from exc

        try:
            component = SelectionComponent.objects.get(
                pk=component_id, admission_period=application.admission_period, is_active=True
            )
        except SelectionComponent.DoesNotExist as exc:
            raise NotFound({"detail": "Selection component not found for this period."}) from exc

        # Score range validation
        if score < Decimal("0.00") or score > component.max_score:
            raise ValidationError({"score": f"Score must be between 0 and {component.max_score}."})

        # Weighted score calculation: (score / max_score) * weight
        weighted_score = (score / component.max_score) * component.weight

        assessment, _ = Assessment.objects.update_or_create(
            application=application,
            component=component,
            defaults={
                "assessor": user,
                "score": score,
                "weighted_score": weighted_score,
                "notes": notes,
                "assessed_at": timezone.now(),
            },
        )

        # Update schedule to COMPLETED if any
        AssessmentSchedule.objects.filter(application=application, component=component).update(
            status=AssessmentScheduleStatus.COMPLETED
        )

        # Recalculate application score summary
        ScoreCalculationService.calculate_application_score(application)

        # Check if all active components for period have been assessed
        active_components = SelectionComponent.objects.filter(
            admission_period=application.admission_period, is_active=True
        )
        assessed_comp_ids = set(
            Assessment.objects.filter(application=application).values_list(
                "component_id", flat=True
            )
        )

        all_assessed = all(comp.id in assessed_comp_ids for comp in active_components)

        if all_assessed and application.status in [
            ApplicationStatus.VERIFIED,
            ApplicationStatus.ASSESSMENT_SCHEDULED,
        ]:
            ApplicationStateMachineService.transition(
                user=user,
                application=application,
                to_status=ApplicationStatus.ASSESSED,
                reason="All assessment components completed.",
            )

        return assessment


class RankingService:
    """Service governing deterministic candidate ranking per admission period."""

    @classmethod
    @transaction.atomic
    def rank_period_applications(cls, period_id: uuid.UUID) -> list[ApplicationScore]:
        """Rank applications by final_score DESC, submitted_at ASC, registration_number ASC."""
        scores = (
            ApplicationScore.objects.filter(application__admission_period_id=period_id)
            .select_related("application")
            .order_by(
                "-final_score",
                "application__submitted_at",
                "application__registration_number",
            )
        )

        ranked_list: list[ApplicationScore] = []
        for idx, app_score in enumerate(scores, start=1):
            app_score.rank = idx
            app_score.save(update_fields=["rank", "calculated_at"])
            ranked_list.append(app_score)

        return ranked_list


class DecisionService:
    """Service governing admission decisions and override tracking."""

    @classmethod
    @transaction.atomic
    def make_decision(
        cls,
        user: Any,
        application_id: uuid.UUID,
        decision: str,
        reason: str | None = None,
    ) -> ApplicationDecision:
        has_perm = getattr(user, "has_any_perm_codes", None)
        perm_codes = ["assessment.approve", "application.override"]
        if not (callable(has_perm) and user.has_any_perm_codes(perm_codes)):
            raise PermissionDenied(
                {"detail": "You do not have permission to make admission decisions."}
            )

        try:
            application = (
                Application.objects.select_related("admission_period", "score_summary")
                .prefetch_related("decision")
                .get(pk=application_id)
            )
        except Application.DoesNotExist as exc:
            raise NotFound({"detail": "Application not found."}) from exc

        if decision not in ApplicationDecisionType.values:
            raise ValidationError({"decision": f"Invalid decision type '{decision}'."})

        # Score & Rank snapshot from ApplicationScore if present
        score_summary = getattr(application, "score_summary", None)
        final_score = score_summary.final_score if score_summary else None
        rank = score_summary.rank if score_summary else None

        # Check existing decision for override history
        existing_decision = ApplicationDecision.objects.filter(application=application).first()

        if existing_decision:
            if not reason or not reason.strip():
                raise ValidationError(
                    {
                        "reason": (
                            "A mandatory reason is required when overriding an existing decision."
                        )
                    }
                )

            DecisionHistory.objects.create(
                application_decision=existing_decision,
                old_decision=existing_decision.decision,
                new_decision=decision,
                changed_by=user,
                reason=reason,
            )

            existing_decision.decision = decision
            existing_decision.final_score = final_score
            existing_decision.rank = rank
            existing_decision.decided_by = user
            existing_decision.reason = reason
            existing_decision.published_at = timezone.now()
            existing_decision.save()
            app_decision = existing_decision
        else:
            app_decision = ApplicationDecision.objects.create(
                application=application,
                decision=decision,
                final_score=final_score,
                rank=rank,
                decided_by=user,
                reason=reason,
                published_at=timezone.now(),
            )

        # Handle target application status and waiting list entry
        if decision == ApplicationDecisionType.ACCEPTED:
            # If candidate was in waiting list, update entry status
            wl_entry = WaitingListEntry.objects.filter(application=application).first()
            if wl_entry and wl_entry.status == WaitingListStatus.WAITING:
                wl_entry.status = WaitingListStatus.PROMOTED
                wl_entry.promoted_at = timezone.now()
                wl_entry.promoted_by = user
                wl_entry.save()

            ApplicationStateMachineService.transition(
                user=user,
                application=application,
                to_status=ApplicationStatus.ACCEPTED,
                reason=reason or "Decision set to ACCEPTED.",
            )

        elif decision == ApplicationDecisionType.WAITLISTED:
            # Determine next waiting list position in period
            existing_wl = WaitingListEntry.objects.filter(application=application).first()
            if not existing_wl:
                last_pos = (
                    WaitingListEntry.objects.filter(
                        application__admission_period=application.admission_period,
                        status=WaitingListStatus.WAITING,
                    )
                    .aggregate(max_pos=models.Max("position"))
                    .get("max_pos")
                    or 0
                )
                pos = rank if rank is not None else last_pos + 1
                WaitingListEntry.objects.create(
                    application=application,
                    position=pos,
                    score=final_score or Decimal("0.0000"),
                    status=WaitingListStatus.WAITING,
                )
            else:
                existing_wl.status = WaitingListStatus.WAITING
                existing_wl.score = final_score or Decimal("0.0000")
                existing_wl.save()

            ApplicationStateMachineService.transition(
                user=user,
                application=application,
                to_status=ApplicationStatus.WAITLISTED,
                reason=reason or "Decision set to WAITLISTED.",
            )

        elif decision == ApplicationDecisionType.REJECTED:
            wl_entry = WaitingListEntry.objects.filter(application=application).first()
            if wl_entry and wl_entry.status == WaitingListStatus.WAITING:
                wl_entry.status = WaitingListStatus.CANCELLED
                wl_entry.save()

            ApplicationStateMachineService.transition(
                user=user,
                application=application,
                to_status=ApplicationStatus.REJECTED,
                reason=reason or "Decision set to REJECTED.",
            )

        return app_decision


class WaitingListService:
    """Service governing waiting list management and candidate promotion."""

    @classmethod
    def list_for_period(cls, period_id: uuid.UUID) -> models.QuerySet[WaitingListEntry]:
        return (
            WaitingListEntry.objects.filter(
                application__admission_period_id=period_id,
                status=WaitingListStatus.WAITING,
            )
            .select_related("application__applicant")
            .order_by("position", "-score")
        )

    @classmethod
    @transaction.atomic
    def promote_candidate(
        cls,
        user: Any,
        entry_id: uuid.UUID,
        reason: str,
    ) -> WaitingListEntry:
        if not reason or not reason.strip():
            raise ValidationError(
                {"reason": "A mandatory reason is required to promote candidate."}
            )

        try:
            entry = WaitingListEntry.objects.select_related("application").get(pk=entry_id)
        except WaitingListEntry.DoesNotExist as exc:
            raise NotFound({"detail": "Waiting list entry not found."}) from exc

        # Update decision and application state to ACCEPTED
        DecisionService.make_decision(
            user=user,
            application_id=entry.application_id,
            decision=ApplicationDecisionType.ACCEPTED,
            reason=f"Promoted from waiting list (Position {entry.position}): {reason}",
        )

        entry.refresh_from_db()
        return entry


class AnnouncementService:
    """Service governing announcement publication and applicant result access."""

    @classmethod
    @transaction.atomic
    def publish_period_announcements(
        cls,
        user: Any,
        period_id: uuid.UUID,
        published_at: datetime | None = None,
    ) -> int:
        has_perm = getattr(user, "has_any_perm_codes", None)
        perm_codes = ["announcement.publish", "application.override"]
        if not (callable(has_perm) and user.has_any_perm_codes(perm_codes)):
            raise PermissionDenied(
                {"detail": "You do not have permission to publish announcements."}
            )

        try:
            period = AdmissionPeriod.objects.get(pk=period_id)
        except AdmissionPeriod.DoesNotExist as exc:
            raise NotFound({"detail": "Admission period not found."}) from exc

        pub_time = published_at or timezone.now()

        period.announcement_at = pub_time
        period.save(update_fields=["announcement_at", "updated_at"])

        updated_count = ApplicationDecision.objects.filter(
            application__admission_period=period,
        ).update(published_at=pub_time)

        return updated_count

    @classmethod
    @transaction.atomic
    def publish_decision(
        cls,
        user: Any,
        application_id: uuid.UUID,
        published_at: datetime | None = None,
    ) -> ApplicationDecision:
        has_perm = getattr(user, "has_any_perm_codes", None)
        perm_codes = ["announcement.publish", "application.override"]
        if not (callable(has_perm) and user.has_any_perm_codes(perm_codes)):
            raise PermissionDenied(
                {"detail": "You do not have permission to publish announcements."}
            )

        try:
            decision = ApplicationDecision.objects.select_related(
                "application__admission_period"
            ).get(application_id=application_id)
        except ApplicationDecision.DoesNotExist as exc:
            raise NotFound({"detail": "No decision found for this application."}) from exc

        pub_time = published_at or timezone.now()
        decision.published_at = pub_time
        decision.save(update_fields=["published_at", "updated_at"])

        return decision

    @classmethod
    def get_announcement_result(
        cls,
        user: Any,
        application_id: uuid.UUID,
    ) -> dict[str, Any]:
        try:
            application = (
                Application.objects.select_related(
                    "applicant", "admission_period", "score_summary"
                )
                .prefetch_related("decision", "waiting_list_entry")
                .get(pk=application_id)
            )
        except Application.DoesNotExist as exc:
            raise NotFound({"detail": "Application not found."}) from exc

        ApplicantService.check_access(user, application.applicant)

        has_override = getattr(user, "has_any_perm_codes", None) and user.has_any_perm_codes(
            ["announcement.publish", "application.override"]
        )

        decision_obj = getattr(application, "decision", None)
        pub_time = decision_obj.published_at if decision_obj else None
        now = timezone.now()

        is_published = bool(
            pub_time is not None and pub_time <= now
        ) or bool(
            application.admission_period.announcement_at
            and application.admission_period.announcement_at <= now
            and decision_obj is not None
        )

        if not is_published and not has_override:
            return {
                "is_published": False,
                "message": "Hasil seleksi belum diumumkan.",
                "announcement_at": application.admission_period.announcement_at,
                "application_id": application.id,
                "registration_number": application.registration_number,
                "applicant_name": application.applicant.full_name,
            }

        if not decision_obj:
            return {
                "is_published": False,
                "message": "Keputusan hasil seleksi belum ditetapkan.",
                "application_id": application.id,
                "registration_number": application.registration_number,
                "applicant_name": application.applicant.full_name,
            }

        next_steps = cls._build_next_steps(decision_obj.decision, application)

        return {
            "is_published": True,
            "application_id": application.id,
            "registration_number": application.registration_number,
            "applicant_name": application.applicant.full_name,
            "admission_period_name": application.admission_period.name,
            "decision": decision_obj.decision,
            "final_score": decision_obj.final_score,
            "rank": decision_obj.rank,
            "published_at": decision_obj.published_at or now,
            "next_steps": next_steps,
            "letter_url": f"/api/v1/selection/applications/{application.id}/announcement/letter",
        }

    @classmethod
    def public_lookup(
        cls,
        registration_number: str,
        birth_date: Any,
    ) -> dict[str, Any]:
        try:
            application = (
                Application.objects.select_related(
                    "applicant", "admission_period", "score_summary"
                )
                .prefetch_related("decision")
                .get(
                    registration_number__iexact=registration_number.strip(),
                    applicant__birth_date=birth_date,
                )
            )
        except Application.DoesNotExist as exc:
            raise ValidationError(
                {"detail": "Nomor pendaftaran atau tanggal lahir tidak cocok."}
            ) from exc

        decision_obj = getattr(application, "decision", None)
        pub_time = decision_obj.published_at if decision_obj else None
        now = timezone.now()

        is_published = bool(
            pub_time is not None and pub_time <= now
        ) or bool(
            application.admission_period.announcement_at
            and application.admission_period.announcement_at <= now
            and decision_obj is not None
        )

        if not is_published or not decision_obj:
            return {
                "is_published": False,
                "message": "Hasil seleksi belum diumumkan.",
                "announcement_at": application.admission_period.announcement_at,
                "registration_number": application.registration_number,
            }

        masked_name = cls._mask_name(application.applicant.full_name)
        next_steps = cls._build_next_steps(decision_obj.decision, application)

        return {
            "is_published": True,
            "registration_number": application.registration_number,
            "applicant_name_masked": masked_name,
            "admission_period_name": application.admission_period.name,
            "decision": decision_obj.decision,
            "published_at": decision_obj.published_at or now,
            "next_steps": next_steps,
        }

    @classmethod
    def generate_result_letter(cls, user: Any, application_id: uuid.UUID) -> tuple[str, bytes]:
        res = cls.get_announcement_result(user, application_id)
        if not res.get("is_published"):
            raise PermissionDenied(
                {"detail": res.get("message", "Hasil seleksi belum diumumkan.")}
            )

        reg_num = res.get("registration_number") or "REG"
        filename = f"Surat_Hasil_Seleksi_{reg_num}.pdf"

        lines = [
            f"Nomor Pendaftaran : {reg_num}",
            f"Nama Calon Siswa  : {res.get('applicant_name', '')}",
            f"Jalur / Gelombang : {res.get('admission_period_name', '')}",
            f"Status Keputusan  : {res.get('decision', '')}",
        ]
        if res.get("final_score") is not None:
            lines.append(f"Nilai Akhir       : {res['final_score']}")
        if res.get("rank") is not None:
            lines.append(f"Peringkat         : {res['rank']}")

        lines.append("")
        lines.append("Instruksi Langkah Berikutnya:")
        for step in res.get("next_steps", []):
            lines.append(f"- {step}")

        pdf_bytes = cls._build_pdf("SURAT KEPUTUSAN HASIL SELEKSI SPMB AL-IHSAN", lines)
        return filename, pdf_bytes

    @staticmethod
    def _mask_name(full_name: str) -> str:
        parts = full_name.split()
        masked = []
        for p in parts:
            if len(p) <= 2:
                masked.append(p[0] + "*")
            else:
                masked.append(p[0] + "*" * (len(p) - 2) + p[-1])
        return " ".join(masked)

    @staticmethod
    def _build_next_steps(decision: str, application: Application) -> list[str]:
        if decision == ApplicationDecisionType.ACCEPTED:
            return [
                "Lakukan konfirmasi kesediaan dan pendaftaran ulang pada portal.",
                "Lengkapi berkas pendaftaran ulang yang dipersyaratkan.",
                "Lakukan pembayaran biaya daftar ulang sebelum batas waktu.",
            ]
        elif decision == ApplicationDecisionType.WAITLISTED:
            wl_entry = getattr(application, "waiting_list_entry", None)
            pos_info = f" (Nomor urut {wl_entry.position})" if wl_entry else ""
            return [
                f"Anda berada dalam daftar tunggu (Waitlisted){pos_info}.",
                (
                    "Jika ada peserta diterima yang tidak melakukan daftar ulang, "
                    "panitia akan mempromosikan kandidat daftar tunggu."
                ),
                "Pantau secara berkala informasi di portal SPMB.",
            ]
        else:
            return [
                "Terima kasih atas partisipasi Anda dalam proses seleksi SPMB Terpadu Al-Ihsan.",
                "Tetap semangat dan sukses untuk jenjang pendidikan selanjutnya.",
            ]

    @staticmethod
    def _build_pdf(title: str, content_lines: list[str]) -> bytes:
        def pdf_escape(text: str) -> str:
            return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

        stream_ops = [
            "BT",
            "/F1 16 Tf",
            "50 750 Td",
            f"({pdf_escape(title)}) Tj",
            "/F1 10 Tf",
            "0 -25 Td",
        ]
        for line in content_lines:
            stream_ops.append(f"({pdf_escape(line)}) Tj")
            stream_ops.append("0 -15 Td")
        stream_ops.append("ET")

        stream_data = "\n".join(stream_ops).encode("utf-8")
        stream_len = len(stream_data)

        objects: list[str | bytes] = [
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
            (
                "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj"
            ),
            "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
            (
                b"5 0 obj\n<< /Length "
                + str(stream_len).encode("utf-8")
                + b" >>\nstream\n"
                + stream_data
                + b"\nendstream\nendobj"
            ),
        ]

        body = b"%PDF-1.4\n"
        offsets = [0]
        for obj in objects:
            offsets.append(len(body))
            if isinstance(obj, str):
                body += obj.encode("utf-8") + b"\n"
            else:
                body += obj + b"\n"

        start_xref = len(body)
        xref = f"xref\n0 {len(offsets)}\n0000000000 65535 f \n"
        for off in offsets[1:]:
            xref += f"{off:010d} 00000 n \n"
        trailer = (
            f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{start_xref}\n%%EOF\n"
        )

        return body + xref.encode("utf-8") + trailer.encode("utf-8")

