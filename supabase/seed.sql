insert into public.agendas (id, stable_key, title, category, detail, source_label, confidence, approved_at) values
('10000000-0000-4000-8000-000000000001', 'case-aurora-2026', 'Aurora Strategy Challenge', 'Case Comps', 'Submit a 3-slide market entry recommendation and team declaration.', 'Student Affairs · batch announcement', 0.970, now()),
('10000000-0000-4000-8000-000000000002', 'committee-sports-2026', 'Sports Committee selections', 'Committees', 'Complete the interest form before the interaction round.', 'Sports Committee · approved announcement', 0.960, now()),
('10000000-0000-4000-8000-000000000003', 'academics-analytics-2026', 'Analytics elective · problem set 2', 'Academics', 'Upload one PDF per study group.', 'Course Office · correction approved', 0.920, now())
on conflict (id) do nothing;

insert into public.agenda_stages (id, agenda_id, stable_key, name, deadline, note, position) values
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'case-aurora-deck', 'Round 1 deck', '2026-08-11T23:59:00+05:30', 'Extension confirmed by the 9 Aug announcement.', 1),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'case-aurora-finals', 'Campus finals', '2026-08-17T17:30:00+05:30', 'Only for shortlisted teams; venue will be shared later.', 2),
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'sports-interest', 'Interest form', '2026-08-15T20:00:00+05:30', 'Complete before the interaction round.', 1),
('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'sports-interaction', 'Interaction round', '2026-08-19T19:00:00+05:30', 'Time confirmed; room pending.', 2),
('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'analytics-ps2', 'Problem set upload', '2026-08-19T09:00:00+05:30', 'Correction replaced the earlier 18 Aug date.', 1)
on conflict (id) do nothing;

