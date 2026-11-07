`chatgpt_test_private.pem` is a test-only RSA private key copied from the
`jsonwebtoken` 9.3.1 crate's MIT-licensed RSA test fixtures. It is used only to
create synthetic ID tokens for offline verification tests. It is not an OpenAI
key and must never be used outside tests.
