// Setup test environment
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars_long_12345';
process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgrespassword@localhost:5433/dps_contract_test';
