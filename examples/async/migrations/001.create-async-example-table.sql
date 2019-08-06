BEGIN;

CREATE TABLE async_example (
  ID INTEGER PRIMARY KEY,
  NAME TEXT NOT NULL
);

CREATE UNIQUE INDEX async_example_name_uniq ON async_example (
  name
);

END;
