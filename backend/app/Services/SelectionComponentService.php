<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AdmissionPeriod;
use App\Models\SelectionComponent;
use Brick\Math\BigDecimal;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class SelectionComponentService
{
    public static function list(?string $periodId = null): Collection
    {
        $q = SelectionComponent::where('is_active', true)->orderBy('sort_order')->orderBy('name');
        if ($periodId) {
            $q->where('admission_period_id', $periodId);
        }

        return $q->get();
    }

    public static function create(array $data): SelectionComponent
    {
        return DB::transaction(function () use ($data) {
            $period = AdmissionPeriod::find($data['admission_period_id'])
                ?? throw ApiException::notFound('Admission period not found.', 'admission_period_id');

            if (SelectionComponent::where('admission_period_id', $period->id)
                ->whereRaw('LOWER(code) = ?', [mb_strtolower($data['code'])])->exists()) {
                throw ApiException::validation(['code' => "Selection component with code '{$data['code']}' already exists for this period."]);
            }

            $component = SelectionComponent::create($data);
            self::validatePeriodWeights($period->id);

            return $component;
        });
    }

    public static function update(SelectionComponent $component, array $data): SelectionComponent
    {
        return DB::transaction(function () use ($component, $data) {
            if (isset($data['code']) && $data['code'] !== $component->code
                && SelectionComponent::where('admission_period_id', $component->admission_period_id)
                    ->whereRaw('LOWER(code) = ?', [mb_strtolower($data['code'])])
                    ->where('id', '!=', $component->id)->exists()) {
                throw ApiException::validation(['code' => "Selection component code '{$data['code']}' already exists."]);
            }
            $component->update($data);
            self::validatePeriodWeights($component->admission_period_id);

            return $component;
        });
    }

    public static function delete(SelectionComponent $component): void
    {
        if ($component->assessments()->exists() || $component->schedules()->exists()) {
            $component->update(['is_active' => false]);
        } else {
            $component->delete();
        }
    }

    public static function validatePeriodWeights(string $periodId): BigDecimal
    {
        $total = SelectionComponent::where('admission_period_id', $periodId)->where('is_active', true)->get()
            ->reduce(fn (BigDecimal $c, $comp) => $c->plus($comp->weight), BigDecimal::of('0.00'));

        if ($total->isGreaterThan(100)) {
            throw ApiException::validation(['weight' => "Total weight of active components ({$total}%) exceeds 100%."]);
        }

        return $total;
    }
}
