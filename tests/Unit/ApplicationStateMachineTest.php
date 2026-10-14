<?php

namespace Tests\Unit;

use App\Services\ApplicationStateMachine as Machine;
use App\Support\ApplicationStatus as S;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ApplicationStateMachineTest extends TestCase
{
    public function test_every_transition_references_known_statuses(): void
    {
        $known = S::all();

        foreach (Machine::LEGAL_TRANSITIONS as $from => $targets) {
            $this->assertContains($from, $known, "Unknown source status {$from}");
            foreach ($targets as $to) {
                $this->assertContains($to, $known, "Unknown target status {$to} from {$from}");
            }
        }
    }

    public function test_terminal_and_end_states_have_no_outgoing_transitions(): void
    {
        foreach ([S::COMPLETED, S::REJECTED] as $terminal) {
            $this->assertArrayNotHasKey($terminal, Machine::LEGAL_TRANSITIONS);
            foreach (S::all() as $to) {
                $this->assertFalse(Machine::isLegal($terminal, $to), "{$terminal} must be terminal");
            }
        }
    }

    public function test_happy_path_is_connected_from_draft_to_completed(): void
    {
        $path = [
            S::DRAFT, S::SUBMITTED, S::UNDER_VERIFICATION, S::VERIFIED, S::ASSESSED, S::ACCEPTED,
            S::RE_REGISTRATION, S::RE_REGISTRATION_VERIFIED, S::ENROLLED, S::MPLS_ACTIVE,
            S::MPLS_COMPLETED, S::COMPLETED,
        ];

        for ($i = 0; $i < count($path) - 1; $i++) {
            $this->assertTrue(Machine::isLegal($path[$i], $path[$i + 1]), "{$path[$i]} -> {$path[$i + 1]}");
        }
    }

    #[DataProvider('illegalTransitions')]
    public function test_illegal_transitions_are_rejected(string $from, string $to): void
    {
        $this->assertFalse(Machine::isLegal($from, $to));
    }

    /** @return array<string, array{string, string}> */
    public static function illegalTransitions(): array
    {
        return [
            'skip verification' => [S::SUBMITTED, S::VERIFIED],
            'draft straight to accepted' => [S::DRAFT, S::ACCEPTED],
            'cannot go back after decision' => [S::ACCEPTED, S::ASSESSED],
            'rejected cannot be accepted' => [S::REJECTED, S::ACCEPTED],
            'enroll without re-registration' => [S::ACCEPTED, S::ENROLLED],
            'self transition' => [S::DRAFT, S::DRAFT],
            'unknown source' => ['NOPE', S::SUBMITTED],
        ];
    }

    public function test_waitlisted_can_be_promoted_or_rejected_only(): void
    {
        $this->assertTrue(Machine::isLegal(S::WAITLISTED, S::ACCEPTED));
        $this->assertTrue(Machine::isLegal(S::WAITLISTED, S::REJECTED));
        $this->assertFalse(Machine::isLegal(S::WAITLISTED, S::ASSESSED));
    }
}
