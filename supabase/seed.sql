insert into missions (id, name, ship_name, status)
values ('00000000-0000-4000-8000-000000000007', 'ARES-7', 'ORBITAL MEDIC', 'active')
on conflict (id) do nothing;

insert into ship_zones (id, mission_id, label, deck, aliases, position, size) values
('command_deck', '00000000-0000-4000-8000-000000000007', 'COMMAND DECK', 1, '{command deck,flight deck,cockpit}', '[0,1.3,-6.2]', '[3.4,1.3,2.4]'),
('corridor_main', '00000000-0000-4000-8000-000000000007', 'MAIN CORRIDOR', 1, '{corridor,spine}', '[0,0.7,0]', '[1.35,1.15,9.2]'),
('crew_quarters', '00000000-0000-4000-8000-000000000007', 'CREW QUARTERS', 1, '{crew quarters,quarters}', '[-3.5,0.75,-2.2]', '[2.6,1.2,2.4]'),
('medical_bay', '00000000-0000-4000-8000-000000000007', 'MEDICAL BAY', 1, '{medical bay,med bay,sickbay}', '[3.5,0.75,-2.2]', '[2.6,1.2,2.4]'),
('galley', '00000000-0000-4000-8000-000000000007', 'GALLEY', 1, '{galley,wardroom}', '[-3.5,0.75,1.4]', '[2.5,1.15,2.1]'),
('lab', '00000000-0000-4000-8000-000000000007', 'LAB', 1, '{lab,laboratory,lab module}', '[3.5,0.75,1.4]', '[2.5,1.15,2.2]'),
('gym', '00000000-0000-4000-8000-000000000007', 'GYM', 1, '{gym}', '[-3.6,0.75,4.6]', '[2.5,1.2,2.2]'),
('airlock', '00000000-0000-4000-8000-000000000007', 'AIRLOCK', 1, '{airlock}', '[3.7,0.8,4.6]', '[1.15,1.5,1.15]'),
('engineering', '00000000-0000-4000-8000-000000000007', 'ENGINEERING', 0, '{engineering}', '[0,0.85,6.6]', '[1.5,1.6,1.5]'),
('cargo_bay', '00000000-0000-4000-8000-000000000007', 'CARGO BAY', 0, '{cargo,cargo bay}', '[0,0.55,-3.2]', '[2.2,0.9,1.8]'),
('greenhouse', '00000000-0000-4000-8000-000000000007', 'GREENHOUSE', 1, '{greenhouse}', '[6.2,0.75,0.2]', '[2.1,1.2,3.2]')
on conflict (id) do nothing;

insert into astronauts (mission_id, callsign, full_name, role, age, sex, baseline_hr, baseline_spo2, baseline_bp_sys, baseline_bp_dia, baseline_temp_c)
values
('00000000-0000-4000-8000-000000000007', 'NOVA', 'Nova Reyes', 'commander', 41, 'F', 62, 98, 118, 74, 36.6),
('00000000-0000-4000-8000-000000000007', 'KITE', 'Kai Okonkwo', 'pilot', 36, 'M', 66, 98, 122, 76, 36.7),
('00000000-0000-4000-8000-000000000007', 'BOLT', 'Amira Shah', 'engineer', 34, 'F', 70, 97, 116, 72, 36.5),
('00000000-0000-4000-8000-000000000007', 'QUILL', 'Jonah Park', 'scientist', 38, 'M', 64, 98, 120, 78, 36.6),
('00000000-0000-4000-8000-000000000007', 'LENS', 'Lena Vogt', 'medical_officer', 44, 'F', 60, 99, 114, 70, 36.5);

insert into medkit_inventory (mission_id, zone_id, item_name, quantity, notes)
values
('00000000-0000-4000-8000-000000000007', 'medical_bay', 'Pulse oximeter', 2, 'Record the number. Not a diagnosis.'),
('00000000-0000-4000-8000-000000000007', 'medical_bay', 'Supplemental oxygen', 1, 'Trained crew only.'),
('00000000-0000-4000-8000-000000000007', 'medical_bay', 'Defibrillator', 1, 'Only if manifested and the crew is trained.'),
('00000000-0000-4000-8000-000000000007', 'medical_bay', 'Sterile saline', 4, 'Eye irrigation. No unlabeled drops.'),
('00000000-0000-4000-8000-000000000007', 'medical_bay', 'Crew restraint', 3, 'Keep the crewmate from drifting.');
