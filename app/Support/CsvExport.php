<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\StreamedResponse;

/** Streams rows as a UTF-8 CSV download that opens cleanly in Excel/LibreOffice. */
final class CsvExport
{
    /**
     * @param  list<string>  $headers
     * @param  iterable<array<int, mixed>>  $rows
     */
    public static function download(string $filename, array $headers, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel detects UTF-8
            fputcsv($out, $headers, escape: '');
            foreach ($rows as $row) {
                fputcsv($out, array_map(self::cell(...), $row), escape: '');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Neutralise spreadsheet formula injection (cells starting with = + - @ tab or CR). */
    private static function cell(mixed $value): string
    {
        $value = $value instanceof \DateTimeInterface ? $value->format('Y-m-d H:i') : (string) ($value ?? '');

        return $value !== '' && str_contains("=+-@\t\r", $value[0]) ? "'".$value : $value;
    }
}
