-- Generiert aus Video_Caption_Navi.xlsx - im Supabase SQL-Editor ausfuehren
-- Matcht auf Dateinamen-Stamm (Excel: '0052_01' -> Datei '0052_01.mp4')
update scheduler.posts set caption = 'vibing on a loop #mildermann #drums #modularsynth', duration_sec = 28, synth_info = null, drum_info = null where filename like '0052_01' || '.%';
update scheduler.posts set caption = 'searching what feels good #mildermann #drums #modularsynth', duration_sec = 27, synth_info = null, drum_info = 'groove changes and rhtyhmic changes' where filename like '0052_02' || '.%';
update scheduler.posts set caption = 'quick " snare triggers synth" try out', duration_sec = 9, synth_info = null, drum_info = null where filename like '0052_03' || '.%';
update scheduler.posts set caption = 'playing with velocity sensitivity.', duration_sec = 22, synth_info = null, drum_info = null where filename like '0052_04' || '.%';
update scheduler.posts set caption = 'melodies on the snare trigger', duration_sec = 14, synth_info = null, drum_info = null where filename like '0052_05' || '.%';
update scheduler.posts set caption = 'groovin`together', duration_sec = 27, synth_info = null, drum_info = 'florierender umgang mit dem Time' where filename like '0052_06' || '.%';
update scheduler.posts set caption = 'jamming on a loop', duration_sec = 24, synth_info = null, drum_info = null where filename like '0052_07' || '.%';
update scheduler.posts set caption = 'groovin`', duration_sec = 12, synth_info = null, drum_info = 'geil' where filename like '0052_08' || '.%';
update scheduler.posts set caption = 'bassdrum triggers bass', duration_sec = 34, synth_info = null, drum_info = null where filename like '0052_09' || '.%';
update scheduler.posts set caption = 'bassdrum triggers bass', duration_sec = 24, synth_info = null, drum_info = null where filename like '0052_10' || '.%';
update scheduler.posts set caption = 'that synth-loop has such rhythmic freshness', duration_sec = 26, synth_info = null, drum_info = null where filename like '0052_11' || '.%';
update scheduler.posts set caption = 'bassdrum triggers bass', duration_sec = 25, synth_info = null, drum_info = null where filename like '0052_12' || '.%';
update scheduler.posts set caption = 'bassdrum fun;)', duration_sec = 26, synth_info = null, drum_info = null where filename like '0052_13' || '.%';
update scheduler.posts set caption = 'quick jam', duration_sec = 14, synth_info = null, drum_info = null where filename like '0052_14' || '.%';
update scheduler.posts set caption = 'ahoi, ahoi (boot-Emoji)', duration_sec = 40, synth_info = null, drum_info = null where filename like '0052_15' || '.%';
update scheduler.posts set caption = 'it`s so much fun. bassdrum triggers bass', duration_sec = 20, synth_info = null, drum_info = null where filename like '0052_16' || '.%';
update scheduler.posts set caption = 'sometimes the choice is no trigger at all', duration_sec = 18, synth_info = null, drum_info = null where filename like '0052_17' || '.%';
update scheduler.posts set caption = 'experimenting grooves and sounds', duration_sec = 23, synth_info = null, drum_info = null where filename like '0052_18' || '.%';
update scheduler.posts set caption = 'heavy weekend-vibes. enjoy everybody. bassdrum triggers bass', duration_sec = 31, synth_info = null, drum_info = null where filename like '0052_19' || '.%';
update scheduler.posts set caption = 'painting with the cymbals', duration_sec = 16, synth_info = null, drum_info = null where filename like '0052_20' || '.%';
update scheduler.posts set caption = 'seifenblasen emjoiis', duration_sec = 42, synth_info = null, drum_info = null where filename like '0052_21' || '.%';
update scheduler.posts set caption = 'slowing down time', duration_sec = 32, synth_info = null, drum_info = null where filename like '0052_22' || '.%';
update scheduler.posts set caption = 'groovin`(Seifenblasen Emoji, 10Bar)', duration_sec = 19, synth_info = null, drum_info = null where filename like '0053_01' || '.%';
update scheduler.posts set caption = 'groovin`(Seifenblasen Emoji 4Bar)', duration_sec = 9, synth_info = null, drum_info = null where filename like '0053_02' || '.%';
update scheduler.posts set caption = 'bassdrum triggers bass', duration_sec = 18, synth_info = null, drum_info = null where filename like '0053_03' || '.%';
update scheduler.posts set caption = 'bass and drums', duration_sec = 18, synth_info = null, drum_info = null where filename like '0053_04' || '.%';
update scheduler.posts set caption = 'cooking. bassdrum triggers synths', duration_sec = 14, synth_info = null, drum_info = null where filename like '0053_05' || '.%';
update scheduler.posts set caption = 'bassdrum triggers synths', duration_sec = 9, synth_info = null, drum_info = null where filename like '0053_06' || '.%';
update scheduler.posts set caption = 'bassdrum triggers synths. A fresh one to shake a little', duration_sec = 9, synth_info = null, drum_info = null where filename like '0053_07' || '.%';
update scheduler.posts set caption = 'wouu-wouu Sounds in the makin`', duration_sec = 17, synth_info = null, drum_info = null where filename like '0053_08' || '.%';
update scheduler.posts set caption = 'a walk with mogli through the rainy jungle (Seifenblassen-Emoji)', duration_sec = 43, synth_info = null, drum_info = null where filename like '0053_09' || '.%';
update scheduler.posts set caption = 'whats going on? (emoji)', duration_sec = 18, synth_info = null, drum_info = null where filename like '0053_10' || '.%';
update scheduler.posts set caption = 'jammin to that rhtyhmic grain delay  #mildermann #drums #modularsynth', duration_sec = 42, synth_info = null, drum_info = null where filename like '0053_11' || '.%';
update scheduler.posts set caption = 'checking new toys (grain dely? Das hauteil?)', duration_sec = 20, synth_info = null, drum_info = null where filename like '0053_12' || '.%';
update scheduler.posts set caption = 'ending a session like this is the goal (seifenblasen emoji)', duration_sec = 29, synth_info = null, drum_info = null where filename like '0053_13' || '.%';

-- Kontrolle: welche Excel-Zeilen haben KEIN Video gefunden?
-- (nach dem Import pruefen: select filename, caption from scheduler.posts where caption = '' order by filename;)