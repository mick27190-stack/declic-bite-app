CREATE OR REPLACE FUNCTION public.check_order_creation_cutoff_window(_order_type text, _pickup_time text, _paris_minutes integer, _win_start integer, _win_end integer)
 RETURNS void LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  slot_minutes int;
  earliest_allowed int;
  delivery_first int := _win_start + 45;
  delivery_last int := _win_end;
  takeaway_last int := _win_end - 30;
  delivery_lead constant int := 45;
  delivery_grace constant int := 8;
  delivery_cutoff int := _win_end - 43;
  takeaway_cutoff int := _win_end - 29;
  quarter int;
  sunday_extension boolean := EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Paris')) = 0
    AND _win_start = 18 * 60 AND _win_end = 21 * 60 + 30;
BEGIN
  IF _order_type = 'emporter' THEN
    IF sunday_extension THEN
      takeaway_cutoff := 21 * 60 + 5;
    END IF;
    IF _paris_minutes >= takeaway_cutoff THEN
      RAISE EXCEPTION 'Les commandes à emporter ne sont plus acceptées pour ce service.';
    END IF;
    IF sunday_extension AND _paris_minutes >= 20 * 60 + 50
       AND _pickup_time IS DISTINCT FROM '21:05' THEN
      RAISE EXCEPTION 'Seul le créneau à emporter de 21h05 reste disponible pour ce service.';
    END IF;
  END IF;
  IF _order_type = 'livraison' THEN
    IF _paris_minutes >= delivery_cutoff THEN
      RAISE EXCEPTION 'Les commandes en livraison ne sont plus acceptées pour ce service.';
    END IF;
    IF _pickup_time IS NULL OR _pickup_time !~ '^\d{2}:\d{2}$' THEN
      RAISE EXCEPTION 'Merci de choisir un créneau de livraison.';
    END IF;
    slot_minutes := split_part(_pickup_time, ':', 1)::int * 60 + split_part(_pickup_time, ':', 2)::int;
    IF slot_minutes < delivery_first OR slot_minutes > delivery_last OR (slot_minutes % 15) <> 0 THEN
      RAISE EXCEPTION 'Créneau de livraison invalide pour les horaires de ce service.';
    END IF;
    quarter := (_paris_minutes / 15) * 15;
    earliest_allowed := (CASE WHEN _paris_minutes - quarter <= delivery_grace THEN quarter ELSE quarter + 15 END) + delivery_lead;
    IF slot_minutes < earliest_allowed THEN
      RAISE EXCEPTION 'Ce créneau de livraison n''est plus disponible. Merci d''en choisir un autre.';
    END IF;
  END IF;
END;
$function$;