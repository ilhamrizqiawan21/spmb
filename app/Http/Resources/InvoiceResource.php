<?php

namespace App\Http\Resources;

use App\Support\PaymentStatus;
use Brick\Math\BigDecimal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $i = $this->resource;
        $payments = $i->relationLoaded('payments') ? $i->payments : collect();

        $paid = BigDecimal::zero();
        foreach ($payments->where('status', PaymentStatus::PAID) as $payment) {
            $paid = $paid->plus(BigDecimal::of((string) $payment->amount));
        }
        $balance = BigDecimal::of((string) $i->amount)->minus($paid);

        return [
            'id' => $i->id,
            'application_id' => $i->application_id,
            'invoice_number' => $i->invoice_number,
            'type' => $i->type,
            'amount' => (string) $i->amount,
            'paid_amount' => (string) $paid->toScale(2),
            'balance' => (string) ($balance->isNegative() ? BigDecimal::zero()->toScale(2) : $balance->toScale(2)),
            'due_date' => $i->due_date,
            'status' => $i->status,
            'description' => $i->description,
            'payments' => PaymentResource::collection($payments)->resolve($request),
            'created_at' => $i->created_at,
        ];
    }
}
