"""Tests for Selection Components, Assessment Schedules, Scoring, and Ranking (F9)."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from django.test import Client
from rest_framework import status

from apps.admission.models import (
    AcademicYear,
    AdmissionPeriod,
    Applicant,
    Application,
    ApplicationStatus,
    GuardianRelationship,
)
from apps.auth.models import Role, User, UserRole
from apps.selection.models import (
    Assessment,
    SelectionComponent,
)
from apps.selection.services import RankingService, ScoreCalculationService


@pytest.fixture
def active_period(db: None) -> AdmissionPeriod:
    ay = AcademicYear.objects.create(
        name="2026/2027",
        start_date=date(2026, 7, 1),
        end_date=date(2027, 6, 30),
        is_active=True,
    )
    now = datetime.now(UTC)
    return AdmissionPeriod.objects.create(
        academic_year=ay,
        name="Gelombang 1",
        code="GEL-1",
        registration_start=now - timedelta(days=1),
        registration_end=now + timedelta(days=30),
        is_active=True,
    )


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(
        name="Admin Selection",
        email="admin.sel@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="super_admin")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def assessor_user(db: None) -> User:
    user = User.objects.create_user(
        name="Assessor One",
        email="assessor1@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="assessor")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin_client(admin_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "admin.sel@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def assessor_client(assessor_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "assessor1@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def verified_application(active_period: AdmissionPeriod, admin_user: User) -> Application:
    applicant = Applicant.objects.create(
        owner_user=admin_user,
        full_name="Budi Seleksi",
        gender="MALE",
        birth_date=date(2015, 5, 10),
        birth_place="Bandung",
        religion="ISLAM",
        address="Jl. Al-Ihsan No. 100",
    )
    applicant.guardians.create(
        relationship=GuardianRelationship.FATHER,
        full_name="Bapak Budi",
        phone="081234567890",
        address="Jl. Al-Ihsan No. 100",
        is_primary_contact=True,
    )
    return Application.objects.create(
        applicant=applicant,
        admission_period=active_period,
        registration_number="REG-2027-SEL01",
        status=ApplicationStatus.VERIFIED,
        submitted_at=datetime.now(UTC),
        current_step=5,
        completion_percentage=100,
    )


@pytest.mark.django_db
def test_selection_component_crud_and_weight_validation(
    admin_client: Client, active_period: AdmissionPeriod
):
    # 1. Create component 1 (Weight: 60%)
    res1 = admin_client.post(
        "/api/v1/selection/components",
        {
            "admission_period_id": str(active_period.id),
            "name": "Tes Akademik",
            "code": "ACADEMIC",
            "weight": "60.00",
            "max_score": "100.00",
        },
        content_type="application/json",
    )
    assert res1.status_code == status.HTTP_201_CREATED
    comp1_id = res1.json()["id"]

    # 2. Create component 2 (Weight: 40%)
    res2 = admin_client.post(
        "/api/v1/selection/components",
        {
            "admission_period_id": str(active_period.id),
            "name": "Wawancara",
            "code": "INTERVIEW",
            "weight": "40.00",
            "max_score": "100.00",
        },
        content_type="application/json",
    )
    assert res2.status_code == status.HTTP_201_CREATED

    # 3. Try to update component 1 weight to 70% (Total: 110%) -> Exceeds 100%
    res_err = admin_client.patch(
        f"/api/v1/selection/components/{comp1_id}",
        {"weight": "70.00"},
        content_type="application/json",
    )
    assert res_err.status_code == status.HTTP_400_BAD_REQUEST
    assert "exceeds 100%" in str(res_err.json())


@pytest.mark.django_db
def test_assessment_schedule_and_state_transition(
    assessor_client: Client,
    active_period: AdmissionPeriod,
    verified_application: Application,
):
    component = SelectionComponent.objects.create(
        admission_period=active_period,
        name="Tes Al-Qur'an",
        code="QURAN",
        weight=Decimal("50.00"),
        max_score=Decimal("100.00"),
    )

    sched_time = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    res = assessor_client.post(
        "/api/v1/selection/schedules",
        {
            "application_id": str(verified_application.id),
            "component_id": str(component.id),
            "scheduled_at": sched_time,
            "location": "Gedung Utama",
            "room": "Ruang A1",
        },
        content_type="application/json",
    )
    assert res.status_code == status.HTTP_201_CREATED
    assert res.json()["status"] == "SCHEDULED"

    verified_application.refresh_from_db()
    assert verified_application.status == ApplicationStatus.ASSESSMENT_SCHEDULED


@pytest.mark.django_db
def test_assessment_score_input_and_score_calculation(
    assessor_client: Client,
    active_period: AdmissionPeriod,
    verified_application: Application,
):
    comp1 = SelectionComponent.objects.create(
        admission_period=active_period,
        name="Tes Tulis",
        code="WRITTEN",
        weight=Decimal("60.00"),
        max_score=Decimal("100.00"),
    )
    comp2 = SelectionComponent.objects.create(
        admission_period=active_period,
        name="Wawancara",
        code="INTERVIEW",
        weight=Decimal("40.00"),
        max_score=Decimal("100.00"),
    )

    # 1. Input score for comp1 (80/100 -> weighted = 48.00)
    res1 = assessor_client.post(
        "/api/v1/selection/assessments/input",
        {
            "application_id": str(verified_application.id),
            "component_id": str(comp1.id),
            "score": "80.00",
            "notes": "Hasil bagus",
        },
        content_type="application/json",
    )
    assert res1.status_code == status.HTTP_200_OK

    # 2. Input score for comp2 (90/100 -> weighted = 36.00)
    res2 = assessor_client.post(
        "/api/v1/selection/assessments/input",
        {
            "application_id": str(verified_application.id),
            "component_id": str(comp2.id),
            "score": "90.00",
            "notes": "Wawancara sangat baik",
        },
        content_type="application/json",
    )
    assert res2.status_code == status.HTTP_200_OK

    # 3. Application score summary check (final_score = 48.00 + 36.00 = 84.0000)
    score_res = assessor_client.get(
        f"/api/v1/selection/applications/{verified_application.id}/scores"
    )
    assert score_res.status_code == status.HTTP_200_OK
    data = score_res.json()
    assert Decimal(data["final_score"]) == Decimal("84.0000")

    # 4. Status should auto-transition to ASSESSED
    verified_application.refresh_from_db()
    assert verified_application.status == ApplicationStatus.ASSESSED


@pytest.mark.django_db
def test_assessment_score_bounds_validation(
    assessor_client: Client,
    active_period: AdmissionPeriod,
    verified_application: Application,
):
    comp = SelectionComponent.objects.create(
        admission_period=active_period,
        name="Tes Tulis",
        code="WRITTEN",
        weight=Decimal("100.00"),
        max_score=Decimal("50.00"),
    )

    # Input score > max_score (60 > 50)
    res = assessor_client.post(
        "/api/v1/selection/assessments/input",
        {
            "application_id": str(verified_application.id),
            "component_id": str(comp.id),
            "score": "60.00",
        },
        content_type="application/json",
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "between 0 and 50" in str(res.json())


@pytest.mark.django_db
def test_deterministic_ranking_service(active_period: AdmissionPeriod, admin_user: User):
    comp = SelectionComponent.objects.create(
        admission_period=active_period,
        name="Tes",
        code="TES",
        weight=Decimal("100.00"),
        max_score=Decimal("100.00"),
    )

    # Candidate 1 (Score 80)
    app1 = Application.objects.create(
        applicant=Applicant.objects.create(
            owner_user=admin_user, full_name="Candidate 1", birth_date=date(2015, 1, 1), address="A"
        ),
        admission_period=active_period,
        registration_number="REG-01",
        status=ApplicationStatus.ASSESSED,
    )
    Assessment.objects.create(
        application=app1,
        component=comp,
        assessor=admin_user,
        score=Decimal("80.00"),
        weighted_score=Decimal("80.00"),
    )
    ScoreCalculationService.calculate_application_score(app1)

    # Candidate 2 (Score 95)
    app2 = Application.objects.create(
        applicant=Applicant.objects.create(
            owner_user=admin_user, full_name="Candidate 2", birth_date=date(2015, 1, 1), address="B"
        ),
        admission_period=active_period,
        registration_number="REG-02",
        status=ApplicationStatus.ASSESSED,
    )
    Assessment.objects.create(
        application=app2,
        component=comp,
        assessor=admin_user,
        score=Decimal("95.00"),
        weighted_score=Decimal("95.00"),
    )

    ScoreCalculationService.calculate_application_score(app2)

    # Execute ranking
    ranked_scores = RankingService.rank_period_applications(active_period.id)
    assert len(ranked_scores) == 2
    assert ranked_scores[0].application_id == app2.id
    assert ranked_scores[0].rank == 1
    assert ranked_scores[1].application_id == app1.id
    assert ranked_scores[1].rank == 2


@pytest.mark.django_db
def test_normal_decision_accepted_and_rejected(
    admin_client: Client,
    verified_application: Application,
):
    # Transition to ASSESSED first
    verified_application.status = ApplicationStatus.ASSESSED
    verified_application.save()

    # Make ACCEPTED decision
    res = admin_client.post(
        f"/api/v1/selection/applications/{verified_application.id}/decision",
        {"decision": "ACCEPTED", "reason": "Lulus seleksi nilai tinggi"},
        content_type="application/json",
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["decision"] == "ACCEPTED"

    verified_application.refresh_from_db()
    assert verified_application.status == ApplicationStatus.ACCEPTED


@pytest.mark.django_db
def test_decision_override_history(
    admin_client: Client,
    verified_application: Application,
):
    verified_application.status = ApplicationStatus.ASSESSED
    verified_application.save()

    # Initial decision ACCEPTED
    admin_client.post(
        f"/api/v1/selection/applications/{verified_application.id}/decision",
        {"decision": "ACCEPTED", "reason": "Disetujui awal"},
        content_type="application/json",
    )

    # Attempt override without reason -> fails with 400
    res_err = admin_client.post(
        f"/api/v1/selection/applications/{verified_application.id}/decision",
        {"decision": "REJECTED", "reason": ""},
        content_type="application/json",
    )
    assert res_err.status_code == status.HTTP_400_BAD_REQUEST
    assert "mandatory reason" in str(res_err.json())

    # Override with valid reason
    res_override = admin_client.post(
        f"/api/v1/selection/applications/{verified_application.id}/decision",
        {"decision": "REJECTED", "reason": "Dibatalkan karena ketidaksesuaian berkas"},
        content_type="application/json",
    )
    assert res_override.status_code == status.HTTP_200_OK
    data = res_override.json()
    assert data["decision"] == "REJECTED"
    assert len(data["histories"]) == 1
    assert data["histories"][0]["old_decision"] == "ACCEPTED"
    assert data["histories"][0]["new_decision"] == "REJECTED"


@pytest.mark.django_db
def test_waiting_list_creation_and_promotion(
    admin_client: Client,
    active_period: AdmissionPeriod,
    verified_application: Application,
):
    verified_application.status = ApplicationStatus.ASSESSED
    verified_application.save()

    # Set decision to WAITLISTED
    res_wl = admin_client.post(
        f"/api/v1/selection/applications/{verified_application.id}/decision",
        {"decision": "WAITLISTED", "reason": "Nilai memenuhi syarat cadangan"},
        content_type="application/json",
    )
    assert res_wl.status_code == status.HTTP_200_OK

    verified_application.refresh_from_db()
    assert verified_application.status == ApplicationStatus.WAITLISTED

    # Check waiting list endpoint
    wl_list_res = admin_client.get(f"/api/v1/selection/periods/{active_period.id}/waiting-list")
    assert wl_list_res.status_code == status.HTTP_200_OK
    entries = wl_list_res.json()
    assert len(entries) == 1
    entry_id = entries[0]["id"]

    # Promote candidate to ACCEPTED
    prom_res = admin_client.post(
        f"/api/v1/selection/waiting-list/{entry_id}/promote",
        {"reason": "Kuota bertambah dari pengunduran diri"},
        content_type="application/json",
    )
    assert prom_res.status_code == status.HTTP_200_OK

    verified_application.refresh_from_db()
    assert verified_application.status == ApplicationStatus.ACCEPTED


@pytest.mark.django_db
def test_unauthorized_decision_blocked(
    active_period: AdmissionPeriod,
    verified_application: Application,
    admin_user: User,
):
    # Unauthenticated client
    anon_client = Client()
    res = anon_client.post(
        f"/api/v1/selection/applications/{verified_application.id}/decision",
        {"decision": "ACCEPTED"},
        content_type="application/json",
    )
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
