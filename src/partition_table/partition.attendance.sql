CREATE TABLE attendances_2025_w10 PARTITION OF attendances FOR
VALUES
FROM ('2025-03-04') TO ('2025-03-11');

CREATE TABLE attendances_2025_w11 PARTITION OF attendances FOR
VALUES
FROM ('2025-03-11') TO ('2025-03-18');

CREATE TABLE attendances_2025_w12 PARTITION OF attendances FOR
VALUES
FROM ('2025-03-18') TO ('2025-03-25');


CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule (
        '0 2 * * *', -- Chạy vào 2:00 AM hàng ngày
        $$DROP
        TABLE IF EXISTS attendances_2025_w05$$ -- Xóa partition tuần cũ
    );