| Operation | LadrillosJS | React 18.3 (keyed, memoized rows) | Vanilla JS (hand-optimized) |
|---|---:|---:|---:|
| create 1,000 rows | 4.3 ms | 5.3 ms | 1.5 ms |
| replace all 1,000 rows | 3.8 ms | 6.3 ms | 2.1 ms |
| partial update (every 10th of 1,000) | 0.9 ms | 1 ms | 0.2 ms |
| select row | 0.7 ms | 0.3 ms | 0 ms |
| swap 2 rows | 0.9 ms | 3.1 ms | 0 ms |
| remove row | 0.8 ms | 0.9 ms | 0.1 ms |
| append 1,000 to 1,000 rows | 3.4 ms | 3.4 ms | 1.2 ms |
| clear 1,000 rows | 1.3 ms | 2.3 ms | 0.9 ms |
| create 10,000 rows | 27.6 ms | 241.2 ms | 13.2 ms |
| **JS payload (min+gzip)** | **33.8 KB** | **47 KB** | ~1 KB |
| JS heap after 1,000 rows | 2.6 MB | 6.3 MB | 1.4 MB |
