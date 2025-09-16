/**
 * NFC Service Performance Test
 * Load tests the NFC redirect service to measure performance
 */

const http = require('http');
const https = require('https');

class NFCPerformanceTest {
  constructor() {
    this.baseUrl = process.env.NFC_SERVICE_URL || 'http://localhost:3000';
    this.testUIDs = [
      'BZR7VDQF',
      'BZBUKT6U', 
      'BZPGUH6H',
      'BZTEST01',
      'BZTEST02'
    ];
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: []
    };
  }

  /**
   * Run performance test
   */
  async runTest(options = {}) {
    const {
      concurrency = 10,
      duration = 30000, // 30 seconds
      requestsPerSecond = 50
    } = options;

    console.log('🚀 Starting NFC Performance Test...');
    console.log(`   Service URL: ${this.baseUrl}`);
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
    
    // Generate report
    this.generateReport(duration);
  }

  /**
   * Worker function for concurrent requests
   */
  async worker(endTime, requestsPerSecond) {
    const interval = 1000 / requestsPerSecond; // ms between requests
    
    while (Date.now() < endTime) {
      const uid = this.testUIDs[Math.floor(Math.random() * this.testUIDs.length)];
      await this.makeRequest(uid);
      await this.sleep(interval);
    }
  }

  /**
   * Make a single request
   */
  async makeRequest(uid) {
    const startTime = Date.now();
    
    try {
      const response = await this.httpRequest(`/q/${uid}`);
      const responseTime = Date.now() - startTime;
      
      this.results.totalRequests++;
      this.results.responseTimes.push(responseTime);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        this.results.successfulRequests++;
      } else {
        this.results.failedRequests++;
        this.results.errors.push({
          uid,
          statusCode: response.statusCode,
          responseTime
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.results.totalRequests++;
      this.results.failedRequests++;
      this.results.errors.push({
        uid,
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
   * Generate performance report
   */
  generateReport(duration) {
    const { totalRequests, successfulRequests, failedRequests, responseTimes, errors } = this.results;
    
    console.log('\n📊 Performance Test Results');
    console.log('='.repeat(50));
    
    // Basic metrics
    const actualRPS = (totalRequests / (duration / 1000)).toFixed(2);
    const successRate = ((successfulRequests / totalRequests) * 100).toFixed(1);
    const errorRate = ((failedRequests / totalRequests) * 100).toFixed(1);
    
    console.log(`Total Requests: ${totalRequests}`);
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
      
      console.log('Response Time Analysis:');
      console.log(`   Min: ${min}ms`);
      console.log(`   Max: ${max}ms`);
      console.log(`   Average: ${avg.toFixed(2)}ms`);
      console.log(`   Median: ${median}ms`);
      console.log(`   95th Percentile: ${p95}ms`);
      console.log(`   99th Percentile: ${p99}ms`);
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
    
    console.log(`Performance Rating: ${rating}`);
    console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log('');
    
    // Error analysis
    if (errors.length > 0) {
      console.log('Error Analysis:');
      const errorTypes = {};
      errors.forEach(error => {
        const key = error.error || `HTTP ${error.statusCode}`;
        errorTypes[key] = (errorTypes[key] || 0) + 1;
      });
      
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} occurrences`);
      });
      console.log('');
    }
    
    // Recommendations
    console.log('💡 Recommendations:');
    
    if (avgResponseTime > 100) {
      console.log('   - Response time is high. Consider database optimization.');
    }
    
    if (parseFloat(successRate) < 95) {
      console.log('   - Success rate is low. Check error logs and database connectivity.');
    }
    
    if (parseFloat(actualRPS) < 10) {
      console.log('   - Throughput is low. Consider increasing concurrency or optimizing queries.');
    }
    
    if (responseTimes.length > 0) {
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      if (p95 > 200) {
        console.log('   - 95th percentile response time is high. Consider caching strategies.');
      }
    }
    
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
  
  const tester = new NFCPerformanceTest();
  tester.runTest(options).catch(console.error);
}

module.exports = NFCPerformanceTest;
