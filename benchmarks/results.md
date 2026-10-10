| Operation | LadrillosJS | React 18.3 (keyed, memoized rows) | Vanilla JS (hand-optimized) |
|---|---:|---:|---:|
| create 1,000 rows | 3.8 ms | 4.3 ms | 1.3 ms |
| replace all 1,000 rows | 4 ms | 7 ms | 2.1 ms |
| partial update (every 10th of 1,000) | 0.9 ms | 1.1 ms | 0.2 ms |
| select row | 0.6 ms | 0.4 ms | 0 ms |
| swap 2 rows | 0.9 ms | 3.3 ms | 0 ms |
| remove row | 0.9 ms | 1 ms | 0.1 ms |
| append 1,000 to 1,000 rows | 3.5 ms | 3.6 ms | 1.2 ms |
| clear 1,000 rows | 1.3 ms | 2.8 ms | 1 ms |
| create 10,000 rows | 29.7 ms | 239.4 ms | 11.6 ms |
| **JS payload (min+gzip)** | **34.8 KB** | **47 KB** | ~1 KB |
| JS heap after 1,000 rows | 2.7 MB | 6.3 MB | 1.4 MB |
