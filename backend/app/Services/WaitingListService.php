<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Models\WaitingListEntry;
use App\Support\DecisionType;
use App\Support\WaitingListStatus;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class WaitingListService
{
    public static function list(string $periodId): Collection
    {
        return WaitingListEntry::with(['application.applicant', 'promotedBy'])
            ->whereHas('application', fn ($q) => $q->where('admission_period_id', $periodId))
            ->where('status', WaitingListStatus::WAITING)
            ->orderBy('position')->orderByDesc('score')->get();
    }

    public static function promote(User $user, string $entryId, string $reason): WaitingListEntry
    {
        if (trim($reason) === '') {
            throw ApiException::validation(['reason' => 'A mandatory reason is required to promote candidate.']);
        }

        return DB::transaction(function () use ($user, $entryId, $reason) {
            $entry = WaitingListEntry::find($entryId) ?? throw ApiException::notFound('Waiting list entry not found.');

            DecisionService::decide(
                $user, $entry->application_id, DecisionType::ACCEPTED,
                "Promoted from waiting list (Position {$entry->position}): {$reason}"
            );

            return $entry->refresh()->load(['application.applicant', 'promotedBy']);
        });
    }
}
