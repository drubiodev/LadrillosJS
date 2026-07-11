| Operation | LadrillosJS | React 18.3 (keyed, memoized rows) | Vanilla JS (hand-optimized) |
|---|---:|---:|---:|
| create 1,000 rows | 3.8 ms | 4.1 ms | 1.8 ms |
| replace all 1,000 rows | 4.1 ms | 7.2 ms | 2.1 ms |
| partial update (every 10th of 1,000) | 1 ms | 1.2 ms | 0.2 ms |
| select row | 0.8 ms | 0.4 ms | 0 ms |
| swap 2 rows | 1.1 ms | 3.3 ms | 0 ms |
| remove row | 1.1 ms | 1 ms | 0.1 ms |
| append 1,000 to 1,000 rows | 3.9 ms | 4.2 ms | 1.2 ms |
| clear 1,000 rows | 1.2 ms | 3 ms | 0.8 ms |
| create 10,000 rows | 28.2 ms | 238.7 ms | 12.6 ms |
| **JS payload (min+gzip)** | **25.9 KB** | **47 KB** | ~1 KB |
| JS heap after 1,000 rows | 2.4 MB | 6.2 MB | 1.3 MB |
