/**
 * BizTag Performance Test
 * Tests the actual BizTag UIDs from your CSV file
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

class BizTagPerformanceTest {
  constructor() {
    this.baseUrl = process.env.NFC_SERVICE_URL || 'http://localhost:3000';
    this.biztagUIDs = this.loadBizTagUIDs();
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      biztagStats: {}
    };
  }

  /**
   * Load BizTag UIDs from CSV
   */
  loadBizTagUIDs() {
    try {
      const csvPath = path.join(__dirname, '../BizTag NFC Links.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').slice(1); // Skip header
      
      const uids = [];
      lines.forEach(line => {
        if (line.trim()) {
          const [bizcode, uid, targetUrl] = line.split(',');
          uids.push({
            bizcode: bizcode.trim(),
            uid: uid.trim(),
            targetUrl: targetUrl.trim()
          });
        }
      });
      
      console.log(`📋 Loaded ${uids.length} BizTag UIDs from CSV`);
      return uids;
    } catch (error) {
      console.error('❌ Error loading BizTag CSV:', error.message);
      return [];
    }
  }

  /**
   * Run BizTag performance test
   */
  async runTest(options = {}) {
    const {
      concurrency = 5,
      duration = 30000, // 30 seconds
      requestsPerSecond = 10
    } = options;

    console.log('🏷️ Starting BizTag Performance Test...');
    console.log(`   Service URL: ${this.baseUrl}`);
    console.log(`   BizTags Available: ${this.biztagUIDs.length}`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Target RPS: ${requestsPerSecond}`);
    console.log('');

    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // Create worker promises
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.worker(endTime, requestsPerSecond / concurrency));
    }
    
    // Wait for all workers to complete
    await Promise.all(workers);
    
    // Generate BizTag-specific report
    this.generateBizTagReport(duration);
  }

  /**
   * Worker function for concurrent requests
   */
  async worker(endTime, requestsPerSecond) {
    const interval = 1000 / requestsPerSecond; // ms between requests
    
    while (Date.now() < endTime) {
      const biztag = this.biztagUIDs[Math.floor(Math.random() * this.biztagUIDs.length)];
      await this.testBizTag(biztag);
      await this.sleep(interval);
    }
  }

  /**
   * Test a specific BizTag
   */
  async testBizTag(biztag) {
    const startTime = Date.now();
    
    try {
      const response = await this.httpRequest(`/q/${biztag.uid}`);
      const responseTime = Date.now() - startTime;
      
      this.results.totalRequests++;
      this.results.responseTimes.push(responseTime);
      
      // Track per-BizTag stats
      if (!this.results.biztagStats[biztag.bizcode]) {
        this.results.biztagStats[biztag.bizcode] = {
          requests: 0,
          successes: 0,
          failures: 0,
          totalResponseTime: 0,
          minResponseTime: Infinity,
          maxResponseTime: 0
        };
      }
      
      const stats = this.results.biztagStats[biztag.bizcode];
      stats.requests++;
      stats.totalResponseTime += responseTime;
      stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
      stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        this.results.successfulRequests++;
        stats.successes++;
        
        // Check if redirect is working correctly
        if (response.headers.location) {
          console.log(`✅ BizTag ${biztag.bizcode}: ${responseTime}ms → ${response.headers.location}`);
        }
      } else {
        this.results.failedRequests++;
        stats.failures++;
        this.results.errors.push({
          bizcode: biztag.bizcode,
          uid: biztag.uid,
          statusCode: response.statusCode,
          responseTime
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.results.totalRequests++;
      this.results.failedRequests++;
      this.results.errors.push({
        bizcode: biztag.bizcode,
        uid: biztag.uid,
        error: error.message,
        responseTime
      });
    }
  }

  /**
   * Make HTTP request
   */
  async httpRequest(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Generate BizTag-specific report
   */
  generateBizTagReport(duration) {
    const { totalRequests, successfulRequests, failedRequests, responseTimes, biztagStats } = this.results;
    
    console.log('\n🏷️ BizTag Performance Test Results');
    console.log('='.repeat(60));
    
    // Basic metrics
    const actualRPS = (totalRequests / (duration / 1000)).toFixed(2);
    const successRate = ((successfulRequests / totalRequests) * 100).toFixed(1);
    const errorRate = ((failedRequests / totalRequests) * 100).toFixed(1);
    
    console.log(`Total BizTag Requests: ${totalRequests}`);
    console.log(`Successful: ${successfulRequests} (${successRate}%)`);
    console.log(`Failed: ${failedRequests} (${errorRate}%)`);
    console.log(`Actual RPS: ${actualRPS}`);
    console.log('');
    
    // Response time analysis
    if (responseTimes.length > 0) {
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const min = sortedTimes[0];
      const max = sortedTimes[sortedTimes.length - 1];
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
      
      console.log('BizTag Response Time Analysis:');
      console.log(`   Min: ${min}ms`);
      console.log(`   Max: ${max}ms`);
      console.log(`   Average: ${avg.toFixed(2)}ms`);
      console.log(`   Median: ${median}ms`);
      console.log(`   95th Percentile: ${p95}ms`);
      console.log(`   99th Percentile: ${p99}ms`);
      console.log('');
    }
    
    // Top performing BizTags
    console.log('🏆 Top Performing BizTags:');
    const topBizTags = Object.entries(biztagStats)
      .filter(([_, stats]) => stats.requests > 0)
      .map(([bizcode, stats]) => ({
        bizcode,
        avgResponseTime: (stats.totalResponseTime / stats.requests).toFixed(2),
        successRate: ((stats.successes / stats.requests) * 100).toFixed(1),
        requests: stats.requests
      }))
      .sort((a, b) => parseFloat(a.avgResponseTime) - parseFloat(b.avgResponseTime))
      .slice(0, 10);
    
    topBizTags.forEach((biztag, index) => {
      console.log(`   ${index + 1}. ${biztag.bizcode}: ${biztag.avgResponseTime}ms (${biztag.successRate}% success, ${biztag.requests} requests)`);
    });
    console.log('');
    
    // Problematic BizTags
    const problematicBizTags = Object.entries(biztagStats)
      .filter(([_, stats]) => stats.requests > 0 && stats.failures > 0)
      .map(([bizcode, stats]) => ({
        bizcode,
        failureRate: ((stats.failures / stats.requests) * 100).toFixed(1),
        failures: stats.failures,
        requests: stats.requests
      }))
      .sort((a, b) => parseFloat(b.failureRate) - parseFloat(a.failureRate));
    
    if (problematicBizTags.length > 0) {
      console.log('⚠️ Problematic BizTags:');
      problematicBizTags.forEach((biztag, index) => {
        console.log(`   ${index + 1}. ${biztag.bizcode}: ${biztag.failureRate}% failure rate (${biztag.failures}/${biztag.requests})`);
      });
      console.log('');
    }
    
    // Performance rating
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    let rating = 'Excellent';
    if (avgResponseTime > 100) rating = 'Poor';
    else if (avgResponseTime > 50) rating = 'Fair';
    else if (avgResponseTime > 20) rating = 'Good';
    
    console.log(`BizTag Performance Rating: ${rating}`);
    console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log('');
    
    // Recommendations
    console.log('💡 BizTag Optimization Recommendations:');
    
    if (avgResponseTime > 100) {
      console.log('   - BizTag response time is high. Database indexes are critical.');
    }
    
    if (parseFloat(successRate) < 95) {
      console.log('   - Some BizTags are failing. Check database connectivity and UID mapping.');
    }
    
    if (problematicBizTags.length > 0) {
      console.log(`   - ${problematicBizTags.length} BizTags have failures. Investigate specific UIDs.`);
    }
    
    console.log('   - Consider implementing BizTag caching for frequently accessed tags.');
    console.log('   - Monitor BizTag performance in production with real traffic.');
    console.log('');
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'concurrency') options.concurrency = parseInt(value);
    else if (key === 'duration') options.duration = parseInt(value) * 1000;
    else if (key === 'rps') options.requestsPerSecond = parseInt(value);
  }
  
  const tester = new BizTagPerformanceTest();
  tester.runTest(options).catch(console.error);
}

module.exports = BizTagPerformanceTest;
