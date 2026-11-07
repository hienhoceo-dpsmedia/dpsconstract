import { describe, expect, it, afterAll } from 'vitest';
import { inspectJsonSource } from '../../server/modules/import/inspect';
import { applyJsonImport } from '../../server/modules/import/apply';
import path from 'node:path';
import fs from 'node:fs';

describe('JSON Migration & Import Ledger (T13, T14)', () => {
  const fixturePath = path.resolve('tests/fixtures/legacy-contracts.json');
  const tempFixturePath = path.resolve(`tests/fixtures/temp-import-${Date.now()}.json`);

  afterAll(() => {
    if (fs.existsSync(tempFixturePath)) {
      fs.unlinkSync(tempFixturePath);
    }
  });

  it('dry-run inspection reports source hash, counts and missing files without writing to DB', () => {
    const report = inspectJsonSource(fixturePath);
    expect(report.sourceSha256).toBeDefined();
    expect(report.totalContracts).toBe(1);
    expect(report.seedContractsCount).toBe(0);
    expect(report.missingFiles.length).toBeGreaterThan(0); // non_existent_file.docx detected
  });

  it('applies import atomically and is idempotent on re-run', async () => {
    const uniqueContractId = `con_import_test_${Date.now()}`;
    const dynamicFixture = {
      contracts: [
        {
          id: uniqueContractId,
          name: 'Dynamic Import Contract',
          contractNumber: `HD-DYN-${Date.now()}`,
          partnerName: 'Dynamic Partner',
          value: '80,000,000 VND',
          status: 'Chờ in',
        },
      ],
    };

    fs.writeFileSync(tempFixturePath, JSON.stringify(dynamicFixture, null, 2), 'utf-8');

    const run1 = await applyJsonImport({
      sourcePath: tempFixturePath,
    });
    expect(run1.inserted).toBe(1);
    expect(run1.alreadyImported).toBe(0);

    // Re-running the same source file must not duplicate contracts
    const run2 = await applyJsonImport({
      sourcePath: tempFixturePath,
    });
    expect(run2.inserted).toBe(0);
    expect(run2.alreadyImported).toBe(1);
  });
});
