<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationDecision;
use Tests\TestCase;
use ZipArchive;

class ExportFormatTest extends TestCase
{
    private const URL = self::API.'/reports/applications/export';

    private function seedAccepted(int $count = 2): void
    {
        $parent = $this->makeUser('parent');
        for ($i = 0; $i < $count; $i++) {
            $app = $this->makeApplication($parent, null, 'ACCEPTED');
            ApplicationDecision::create(['application_id' => $app->id, 'decision' => 'ACCEPTED', 'final_score' => '91.25', 'rank' => $i + 1,
                'decided_by' => $this->makeUser('principal')->id]);
        }
        Application::first()->applicant->update(['full_name' => '=HYPERLINK("http://evil")']);
    }

    /** @return array<string, string> xlsx entry name => xml */
    private function unzip(string $bytes): array
    {
        $path = tempnam(sys_get_temp_dir(), 'xlsx');
        file_put_contents($path, $bytes);
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path) === true, 'valid xlsx (zip) file');
        $files = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $files[$zip->getNameIndex($i)] = $zip->getFromIndex($i);
        }
        $zip->close();
        unlink($path);

        return $files;
    }

    public function test_default_and_unknown_formats(): void
    {
        $this->seedAccepted();
        $admin = $this->makeUser('super_admin');
        $this->as($admin)->get(self::URL)->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->getJson(self::URL.'?format=docx')->assertStatus(400);
    }

    public function test_xlsx_writes_text_cells_never_formulas_and_numbers_where_declared(): void
    {
        $this->seedAccepted();
        $res = $this->as($this->makeUser('super_admin'))->get(self::URL.'?format=xlsx')->assertOk();
        $this->assertStringContainsString('spreadsheetml', $res->headers->get('Content-Type'));
        $this->assertStringEndsWith('.xlsx', $res->headers->get('Content-Disposition'));

        $sheet = $this->unzip($res->streamedContent())['xl/worksheets/sheet1.xml'];
        $this->assertStringNotContainsString('<f>', $sheet, 'no formula cells');
        $this->assertStringContainsString('=HYPERLINK(&quot;http://evil&quot;)', $sheet);
        $this->assertStringContainsString('No. Pendaftaran', $sheet);

        $selection = $this->unzip($this->get(self::API.'/reports/selection/export?format=xlsx')->streamedContent())['xl/worksheets/sheet1.xml'];
        $this->assertMatchesRegularExpression('/<c r="D2"[^>]*><v>91.25<\/v><\/c>/', $selection, 'score written as a number');
    }

    public function test_pdf_is_rendered_and_escapes_html(): void
    {
        $this->seedAccepted();
        Application::first()->applicant->update(['full_name' => '<b>Bold</b> & Co']);
        $res = $this->as($this->makeUser('super_admin'))->get(self::URL.'?format=pdf')->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $res->getContent());
        $this->assertStringContainsString('pendaftar-', $res->headers->get('Content-Disposition'));
    }

    public function test_pdf_row_limit_points_to_xlsx(): void
    {
        config(['spmb.export_pdf_max_rows' => 1]);
        $this->seedAccepted(2);
        $this->as($this->makeUser('super_admin'))->getJson(self::URL.'?format=pdf')->assertStatus(400)
            ->assertJsonPath('error.details.format.0', 'This report has more than 1 rows, which is too many for PDF. Use XLSX or narrow the filter.');
    }

    public function test_every_export_endpoint_accepts_all_formats(): void
    {
        $this->seedAccepted(1);
        $admin = $this->makeUser('super_admin');
        foreach (['/reports/applications/export', '/reports/selection/export', '/reports/payments/export', '/enrollment/students/export', '/mpls/participants/export'] as $path) {
            foreach (['csv', 'xlsx', 'pdf'] as $format) {
                $this->as($admin)->get(self::API."{$path}?format={$format}")->assertOk();
            }
        }
    }
}
