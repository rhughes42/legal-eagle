-- Sample legal documents for testing
INSERT INTO "Document" (id, title, content, "sourceUrl", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'Employment Contract Template',
    'This Employment Agreement is entered into between [Employer] and [Employee]. The Employee agrees to perform duties as assigned and maintain confidentiality of company information. Compensation shall be $[Amount] per year, payable bi-weekly.',
    'https://example.com/docs/employment-contract.pdf',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Non-Disclosure Agreement',
    'This Non-Disclosure Agreement (NDA) is made between the Disclosing Party and the Receiving Party. The Receiving Party agrees to maintain strict confidentiality regarding all proprietary information disclosed during the term of this agreement.',
    'https://example.com/docs/nda.pdf',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Terms of Service',
    'By accessing this website, you agree to be bound by these Terms of Service. We reserve the right to modify these terms at any time. Your continued use of the service constitutes acceptance of any changes.',
    NULL,
    NOW(),
    NOW()
  );
