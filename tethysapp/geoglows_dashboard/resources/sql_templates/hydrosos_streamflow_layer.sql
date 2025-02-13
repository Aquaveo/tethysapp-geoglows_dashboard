SELECT rivers.id AS river_id, stream_order, geometry, category
FROM rivers
LEFT JOIN river_hydrosos
    ON rivers.id = river_hydrosos.river_id
WHERE river_hydrosos.date = '%selected_month%' AND stream_order >= %min_stream_order% 
    AND (%is_vpu% OR rivers.river_country = '%country%')