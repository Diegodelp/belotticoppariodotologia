-- Extiende las etiquetas disponibles para las fotografías intraorales
alter type public.media_label add value if not exists 'intraoral_superior';
alter type public.media_label add value if not exists 'intraoral_inferior';
