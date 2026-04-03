-- =====================================================
-- Migration : Mise à jour des chemins d'images en .webp
-- =====================================================

-- Mettre à jour tous les chemins d'images pour utiliser .webp au lieu de .png
UPDATE public.achievements
SET image_path = REPLACE(image_path, '.png', '.webp')
WHERE image_path LIKE '%.png';

-- =====================================================
-- Fin de la migration
-- =====================================================

