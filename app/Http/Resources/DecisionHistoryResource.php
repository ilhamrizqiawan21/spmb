<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DecisionHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_decision_id' => $this->resource->application_decision_id,
            'old_decision' => $this->resource->old_decision,
            'new_decision' => $this->resource->new_decision,
            'changed_by_id' => $this->resource->changed_by,
            'changed_by_name' => $this->resource->changedBy->name,
            'reason' => $this->resource->reason,
            'created_at' => $this->resource->created_at,
        ];
    }
}
