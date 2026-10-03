ALTER TABLE public.courses ADD COLUMN training_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int;
UPDATE public.courses SET training_year = EXTRACT(YEAR FROM created_at)::int;