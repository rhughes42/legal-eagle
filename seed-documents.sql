-- Sample legal documents for testing the current schema
INSERT INTO "Document" ("fileName", "title", "date", "court", "caseNumber", "summary", "metadata")
VALUES
  (
    'employment-contract.pdf',
    'Employment Contract Template',
    '2024-02-01T00:00:00Z',
    'Superior Court',
    'EMP-2024-0042',
    'Employment agreement outlining duties, compensation, and confidentiality.',
    '{"rawText":"Employment agreement between employer and employee."}'::jsonb
  ),
  (
    'mutual-nda.html',
    'Mutual Non-Disclosure Agreement',
    '2023-11-15T00:00:00Z',
    'Chancery Court',
    'NDA-2023-9981',
    'Mutual NDA covering proprietary information shared between parties.',
    '{"rawText":"The receiving party agrees to protect proprietary information."}'::jsonb
  ),
  (
    'terms-of-service.pdf',
    'Terms of Service',
    NULL,
    NULL,
    NULL,
    'Standard terms of service for a SaaS platform.',
    '{"rawText":"By accessing this website, you agree to be bound by these terms."}'::jsonb
  );
