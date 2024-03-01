SELECT rivers.id AS rivid, stream_order, geometry, category
FROM rivers
LEFT JOIN river_hydrosos
    ON rivers.id = river_hydrosos.rivid
WHERE river_hydrosos.month = '%selected_month%'