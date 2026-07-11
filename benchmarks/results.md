| Operation | LadrillosJS | React 18.3 (keyed, memoized rows) | Vanilla JS (hand-optimized) |
|---|---:|---:|---:|
| create 1,000 rows | 3.5 ms | 3.8 ms | 1.7 ms |
| replace all 1,000 rows | 4.3 ms | 6.8 ms | 2 ms |
| partial update (every 10th of 1,000) | 1.2 ms | 1.3 ms | 0.1 ms |
| select row | 0.8 ms | 0.4 ms | 0 ms |
| swap 2 rows | 1.1 ms | 3.6 ms | 0 ms |
| remove row | 1 ms | 1.1 ms | 0.1 ms |
| append 1,000 to 1,000 rows | 3.7 ms | 4.5 ms | 1.3 ms |
| clear 1,000 rows | 1.1 ms | 2.5 ms | 0.8 ms |
| create 10,000 rows | 27.7 ms | 246.3 ms | 12 ms |
| **JS payload (min+gzip)** | **25.9 KB** | **47 KB** | ~1 KB |
| JS heap after 1,000 rows | 2.4 MB | 6.2 MB | 1.3 MB |
