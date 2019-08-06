BEGIN;

CREATE TABLE callback_example (
  ID INTEGER PRIMARY KEY,
  NAME TEXT NOT NULL
);

CREATE UNIQUE INDEX callback_example_name_uniq ON callback_example (
  name
);

END;
