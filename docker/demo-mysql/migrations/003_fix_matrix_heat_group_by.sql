-- 修复 vs_official_matrix_heat 在 ONLY_FULL_GROUP_BY 下的兼容性
CREATE OR REPLACE VIEW vs_official_matrix_heat AS
SELECT CASE day_of_week
    WHEN 1 THEN '周日' WHEN 2 THEN '周一' WHEN 3 THEN '周二' WHEN 4 THEN '周三'
    WHEN 5 THEN '周四' WHEN 6 THEN '周五' WHEN 7 THEN '周六'
  END AS x_dim, channel AS y_dim, SUM(amount) AS heat_value
FROM (
  SELECT DAYOFWEEK(sale_date) AS day_of_week, channel, amount FROM sales
) src
GROUP BY day_of_week, channel;
