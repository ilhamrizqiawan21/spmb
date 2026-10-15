<?php

namespace App\Support;

use App\Exceptions\ApiException;
use Dompdf\Dompdf;
use Dompdf\Options;
use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Cell\EmptyCell;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Report downloads in CSV, XLSX or PDF (PRD §14). Every format treats cell values as plain
 * text: spreadsheet formula injection is neutralised in CSV and impossible in XLSX (string
 * cells only); the PDF escapes HTML.
 */
final class TableExport
{
    public const FORMATS = ['csv', 'xlsx', 'pdf'];

    /**
     * @param  list<string>  $headers
     * @param  iterable<array<int, mixed>>  $rows
     * @param  list<int>  $numericColumns  column indexes written as numbers in XLSX (e.g. amounts, counts)
     */
    public static function download(
        string $format,
        string $basename,
        string $title,
        array $headers,
        iterable $rows,
        array $numericColumns = [],
    ): Response {
        $filename = $basename.'-'.now()->format('Ymd-His').'.'.$format;

        return match ($format) {
            'xlsx' => self::xlsx($filename, $title, $headers, $rows, $numericColumns),
            'pdf' => self::pdf($filename, $title, $headers, $rows),
            default => self::csv($filename, $headers, $rows),
        };
    }

    private static function csv(string $filename, array $headers, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel detects UTF-8
            fputcsv($out, $headers, escape: '');
            foreach ($rows as $row) {
                fputcsv($out, array_map(fn ($v) => self::neutralise(self::text($v)), $row), escape: '');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private static function xlsx(string $filename, string $title, array $headers, iterable $rows, array $numericColumns): StreamedResponse
    {
        return response()->streamDownload(function () use ($title, $headers, $rows, $numericColumns) {
            $writer = new XlsxWriter;
            $writer->openToFile('php://output');
            $writer->getCurrentSheet()->setName(mb_substr($title, 0, 31));
            $bold = (new Style)->withFontBold(true);
            $writer->addRow(new Row(array_map(fn ($h) => new StringCell($h, $bold), $headers)));
            foreach ($rows as $row) {
                $cells = [];
                foreach (array_values($row) as $i => $value) {
                    $cells[] = self::xlsxCell($value, in_array($i, $numericColumns, true));
                }
                $writer->addRow(new Row($cells));
            }
            $writer->close();
        }, $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    /** Never Cell::fromValue(): it turns strings starting with "=" into live formulas. */
    private static function xlsxCell(mixed $value, bool $numeric): Cell
    {
        $text = self::text($value);
        if ($text === '') {
            return new EmptyCell(null);
        }
        if ($numeric && is_numeric($text)) {
            return new NumericCell(str_contains($text, '.') ? (float) $text : (int) $text);
        }

        return new StringCell($text);
    }

    private static function pdf(string $filename, string $title, array $headers, iterable $rows): Response
    {
        $max = (int) config('spmb.export_pdf_max_rows');
        $body = [];
        foreach ($rows as $row) {
            if (count($body) >= $max) {
                throw ApiException::validation(['format' => "This report has more than {$max} rows, which is too many for PDF. Use XLSX or narrow the filter."]);
            }
            $body[] = array_map(self::text(...), $row);
        }

        $options = new Options;
        $options->setIsRemoteEnabled(false);
        $options->setIsPhpEnabled(false);
        $options->setChroot(resource_path('views'));
        $options->setDefaultFont('DejaVu Sans');
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(view('exports.table', [
            'title' => $title, 'headers' => $headers, 'rows' => $body,
            'generatedAt' => now()->timezone('Asia/Jakarta')->format('d/m/Y H:i').' WIB',
        ])->render());
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private static function text(mixed $value): string
    {
        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d H:i') : (string) ($value ?? '');
    }

    /** Neutralise CSV formula injection (cells starting with = + - @ tab or CR). */
    private static function neutralise(string $value): string
    {
        return $value !== '' && str_contains("=+-@\t\r", $value[0]) ? "'".$value : $value;
    }
}
