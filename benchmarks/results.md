| Operation | LadrillosJS | React 18.3 (keyed, memoized rows) | Vanilla JS (hand-optimized) |
|---|---:|---:|---:|
| create 1,000 rows | 9.5 ms | 4.2 ms | 1.8 ms |
| replace all 1,000 rows | 10 ms | 8.3 ms | 2 ms |
| partial update (every 10th of 1,000) | 1.5 ms | 1.2 ms | 0.2 ms |
| select row | 1.3 ms | 0.3 ms | 0 ms |
| swap 2 rows | 1.5 ms | 3.2 ms | 0 ms |
| remove row | 1.5 ms | 1 ms | 0 ms |
| append 1,000 to 1,000 rows | 9.5 ms | 4.4 ms | 1.2 ms |
| clear 1,000 rows | 1.3 ms | 3.4 ms | 0.8 ms |
| create 10,000 rows | 89.2 ms | 217.8 ms | 12.6 ms |
| **JS payload (min+gzip)** | **24.2 KB** | **47 KB** | ~1 KB |
| JS heap after 1,000 rows | 3.8 MB | 6.2 MB | 1.3 MB |
