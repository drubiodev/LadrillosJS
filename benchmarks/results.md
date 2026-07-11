| Operation | LadrillosJS | React 18.3 (keyed, memoized rows) | Vanilla JS (hand-optimized) |
|---|---:|---:|---:|
| create 1,000 rows | 3.5 ms | 3.9 ms | 1.6 ms |
| replace all 1,000 rows | 4.3 ms | 7.6 ms | 2 ms |
| partial update (every 10th of 1,000) | 1.2 ms | 1.2 ms | 0.1 ms |
| select row | 0.7 ms | 0.4 ms | 0 ms |
| swap 2 rows | 1.2 ms | 3.1 ms | 0 ms |
| remove row | 1.1 ms | 1 ms | 0 ms |
| append 1,000 to 1,000 rows | 4.1 ms | 4 ms | 1.2 ms |
| clear 1,000 rows | 1.2 ms | 3.9 ms | 0.8 ms |
| create 10,000 rows | 29.9 ms | 219.7 ms | 12.7 ms |
| **JS payload (min+gzip)** | **25.3 KB** | **47 KB** | ~1 KB |
| JS heap after 1,000 rows | 2.4 MB | 6.2 MB | 1.3 MB |
