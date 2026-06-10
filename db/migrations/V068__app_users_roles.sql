-- Four-role account system + person link + active flag.
ALTER TABLE app.users ADD COLUMN person_id bigint UNIQUE REFERENCES core.person(person_id);
ALTER TABLE app.users ADD COLUMN is_active boolean NOT NULL DEFAULT true;

UPDATE app.users SET role = 'ADMIN' WHERE role = 'staff';
UPDATE app.users SET role = 'SUPER_ADMIN' WHERE email = 'admin@jly.church';

ALTER TABLE app.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN','ADMIN','MINISTRY_HEAD','MEMBER'));
