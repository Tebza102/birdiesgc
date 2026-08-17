-- Birdie Squad MVP validation seed
-- Source: Monthly Medal APRIL@2026-3.xlsx
-- Purpose: reproduce the club's existing spreadsheet ranking before live scoring is introduced.

begin;

insert into public.members (full_name, current_handicap, source_type, source_reference)
select v.full_name, v.current_handicap, 'excel_import', 'Monthly Medal APRIL@2026-3.xlsx'
from (values
('MR TININI MOKOTONG', '10'),
('MR ELIPH KOKWANA', '7'),
('MR MATHEW MOGAFE', '11'),
('MR TSHEPO CHAPHOLE', '18'),
('MR NICO MAHLABA', '6'),
('MR ARON MAHLABA', '0'),
('MR THAPELO TSHETLO', '6'),
('MR DUKE MAPHUNYE', '4'),
('MISS THANDI MABELE', '8'),
('MR SHELTON MAZIYA', '3'),
('MR JACOB  MALOHLE', '10'),
('MR HERMAN RAMILLA', '11'),
('MR TOM NTSHANGASE', '5'),
('MR DUMISANE CELE', '7'),
('MR SIBUSISO MANQELE', '18'),
('MR NGEZANA MASHININI', '12'),
('MR NKULULEKO NTSHANGASE', '12'),
('MR LESLIE MANZINI', '4'),
('MR THABO PHETOANE', '0'),
('MR SIHLE HADEBE', '8'),
('MISS CAROL SIBIYA', '12'),
('MR ALFRED CEBEKHULU', '7'),
('MR LEEPILE MOMPE', '12'),
('MR NDOTHI MADONSELA', '16'),
('MR SLENDA SITHEBE', '+4'),
('DR RITA TEKA', '12'),
('MR VELI HLOPHE', '+2'),
('MR BHEKI MADONSELA', '16'),
('MR DENNIS MASHISHI', '16'),
('MR POLLEN NDLANYA', '12'),
('MR GODFREY MONONYANE', '6'),
('MR ROEDOLF KLOPPER', '+4'),
('MR LAWRENCE MACHABA', '5'),
('MR KRISH GOVENDER', '7'),
('MR MAKHOSINI MNNCULWANE', '7'),
('MR SOLLY MASOMBUKA', '9'),
('MR DINI TETA', '10'),
('MR CHARLES NGIDI', '11'),
('MR TEX LOTTERING', '3'),
('MR KHOTSO MATYILIZA', '11'),
('MR NTOKOZO MSIPHA', '1'),
('MR THABO MOTSWIANE', '0'),
('MR MALUSI MASHAZI', '7'),
('MR MXOLISI THUSI', '16'),
('MR OWEN NHLAPO', '6'),
('MR PAT SHABALALA', '3'),
('MR COLLEN SIBEKO', '4'),
('MR AUBREY KITIME', '12'),
('MR JACOB NDLOVU', '5'),
('MR MOSES ZULU', '9'),
('MR WALTER MATLALA', '2'),
('MR MORAILANE MORAILANE', '5'),
('MR MGIJIMI MAKHUBO', '14'),
('MR SANTOS NKOSI', '18'),
('MR SB MAHLANGU', '18'),
('MR JOE KHUMALO', '4'),
('MR SIPHO LUPHONDO', '18'),
('MR KATLEHO SEBUSI', '18'),
('MER MELUSI MOKOTONG', '10'),
('MR VICTOR DHLAMINI', '8'),
('MR  DANIEL MTHIMKHULU', '8'),
('MR KARABO MOKOENA', '6'),
('MR SHIMI SHIKWAMBANE', '8'),
('MR LUCKY NGOMA', '1'),
('MR MFUNDO MNGUNI', '6'),
('MR VUSI NKOSI', '8'),
('MR THOMAS MOSEHLA', '0'),
('MR WISEMAN HLONGWANE', '4'),
('MISS NOSIPHO MAHLASELA', '24'),
('MR MFANA MANCINZA', '12'),
('MR MANQOBA MASHIYANE', '11'),
('MR MPUMI MASHIYANE', '16'),
('ADV RICKY MAVIMBELA', '12'),
('MR OCEAN DAZA', '12'),
('MR BOTHWELL FUNDIRA', '14'),
('DR WILLIAM SENOAMADI', '12'),
('Ms KEDI KEDIBONE', '24'),
('Ms SHEILA S', '24'),
('MR CHARLES MINGUS', '18'),
('MR JOHANNESS  MAHLANGU (NIGEL)', '2'),
('MRS PHINDI KARL', '24'),
('MS BABALWA CHUCHU', '24'),
('MS CHARMAINE NTSIBANDE', '24')
) as v(full_name, current_handicap)
where not exists (
  select 1 from public.members m
  where m.full_name = v.full_name
    and m.source_reference = 'Monthly Medal APRIL@2026-3.xlsx'
);

with inserted_day as (
  insert into public.golf_days (
    game_number, title, venue, event_date, status, scoring_method, hole_count,
    is_public, source_type, source_reference
  )
  select 15, 'Monthly Medal - Game 15', 'STATEMINES GC', null, 'closed',
         'gross_stroke_v1', 18, false, 'excel_import', 'Monthly Medal APRIL@2026-3.xlsx'
  where not exists (
    select 1 from public.golf_days
    where game_number = 15
      and source_reference = 'Monthly Medal APRIL@2026-3.xlsx'
  )
  returning id
),
target_day as (
  select id from inserted_day
  union all
  select id from public.golf_days
  where game_number = 15
    and source_reference = 'Monthly Medal APRIL@2026-3.xlsx'
  limit 1
),
score_data(full_name, final_score) as (
  values
('MISS CAROL SIBIYA', 71),
('MR SLENDA SITHEBE', 72),
('MR DUKE MAPHUNYE', 75),
('MR VELI HLOPHE', 76),
('MR TOM NTSHANGASE', 77),
('MR WALTER MATLALA', 78),
('MR JOE KHUMALO', 78),
('MR LEEPILE MOMPE', 79),
('MR VICTOR DHLAMINI', 79),
('MR LESLIE MANZINI', 81),
('MR MFUNDO MNGUNI', 82),
('MR TININI MOKOTONG', 83),
('MR SB MAHLANGU', 83),
('MR NDOTHI MADONSELA', 84),
('MR KRISH GOVENDER', 86),
('MR HERMAN RAMILLA', 87),
('MR CHARLES NGIDI', 87),
('MR SOLLY MASOMBUKA', 89),
('MR MORAILANE MORAILANE', 92),
('MR DINI TETA', 94),
('MR TSHEPO CHAPHOLE', 98),
('MR KATLEHO SEBUSI', 99)
)
insert into public.golf_day_players (
  golf_day_id, member_id, handicap_at_start, final_score_override, score_source, sort_order
)
select
  td.id,
  m.id,
  m.current_handicap,
  sd.final_score,
  'imported_total',
  row_number() over (order by sd.final_score asc, sd.full_name asc)
from score_data sd
join public.members m on m.full_name = sd.full_name
cross join target_day td
where not exists (
  select 1 from public.golf_day_players gdp
  where gdp.golf_day_id = td.id and gdp.member_id = m.id
);

commit;
