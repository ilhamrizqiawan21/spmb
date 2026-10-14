<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentRequirement extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'is_required' => true,
        'is_active' => true,
        'max_file_size_bytes' => 5242880,
        'sort_order' => 0,
        'allowed_mime_types' => '[]',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'is_active' => 'boolean',
            'allowed_mime_types' => 'array',
            'max_file_size_bytes' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function applicationDocuments(): HasMany
    {
        return $this->hasMany(ApplicationDocument::class, 'requirement_id');
    }
}
