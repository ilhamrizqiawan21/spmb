<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>{{ $title }}</title>
<style>
    @page { margin: 24px 28px; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; color: #1c2330; }
    h1 { font-size: 13pt; margin: 0 0 2px; }
    .meta { color: #5b6577; margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #dde1e8; padding: 3px 4px; text-align: left; vertical-align: top; }
    th { background: #eef1f5; }
    tr:nth-child(even) td { background: #fafbfc; }
</style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <p class="meta">SPMB Terpadu · dibuat {{ $generatedAt }} · {{ count($rows) }} baris</p>
    <table>
        <thead><tr>@foreach ($headers as $h)<th>{{ $h }}</th>@endforeach</tr></thead>
        <tbody>
        @forelse ($rows as $row)
            <tr>@foreach ($row as $cell)<td>{{ $cell }}</td>@endforeach</tr>
        @empty
            <tr><td colspan="{{ count($headers) }}">Tidak ada data.</td></tr>
        @endforelse
        </tbody>
    </table>
</body>
</html>
