-- Runs once, when the data volume is first created.
-- A separate database for the automated test suite, so tests never touch dev data.
CREATE DATABASE kinetra_test;
