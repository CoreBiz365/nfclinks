/**
 * NFC Service Performance Monitor
 * Monitors and analyzes NFC redirect service performance
 */

const http = require('http');
const https = require('https');

class NFCPerformanceMonitor {
  constructor() {
    this.baseUrl = process.env.NFC_SERVICE_URL || 'http://localhost:3000';
    this.monitoringInterval = 30000; // 30 seconds
    this.alertThresholds = {
      responseTime: 100, // ms
      errorRate: 5, // %
      slowRequestRate: 10 // %
    };
    this.isMonitoring = false;
    this.metrics = {
      checks: 0,
      failures: 0,
      alerts: []
    };
  }

  /**
   * Start performance monitoring
   */
  start() {
    console.log('🚀 Starting NFC Performance Monitor...');
    console.log(`   Service URL: ${this.baseUrl}`);
    console.log(`   Check Interval: ${this.monitoringInterval}ms`);
    console.log(`   Alert Thresholds:`);
    console.log(`     Response Time: >${this.alertThresholds.responseTime}ms`);
    console.log(`     Error Rate: >${this.alertThresholds.errorRate}%`);
    console.log(`     Slow Requests: >${this.alertThresholds.slowRequestRate}%`);
    console.log('');

    this.isMonitoring = true;
    this.monitor();
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    console.log('🛑 Stopping NFC Performance Monitor...');
    this.isMonitoring = false;
  }

  /**
   * Main monitoring loop
   */
  async monitor() {
    while (this.isMonitoring) {
      try {
        await this.checkPerformance();
        await this.sleep(this.monitoringInterval);
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
        await this.sleep(5000); // Wait 5 seconds before retry
      }
    }
  }

  /**
   * Check service performance
   */
  async checkPerformance() {
    const startTime = Date.now();
    
    try {
      const performance = await this.getPerformanceMetrics();
      const responseTime = Date.now() - startTime;
      
      this.metrics.checks++;
      
      // Display current metrics
      this.displayMetrics(performance, responseTime);
      
      // Check for alerts
      this.checkAlerts(performance);
      
    } catch (error) {
      this.metrics.failures++;
      console.error(`❌ Performance check failed: ${error.message}`);
      
      // Alert on repeated failures
      if (this.metrics.failures > 3) {
        this.alert('Service Unavailable', `Failed to connect to NFC service: ${error.message}`);
      }
    }
  }

  /**
   * Get performance metrics from service
   */
  async getPerformanceMetrics() {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/performance`);
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const metrics = JSON.parse(data);
            resolve(metrics.performance);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
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
   * Display current metrics
   */
  displayMetrics(performance, responseTime) {
    const timestamp = new Date().toISOString();
    const successRate = parseFloat(performance.successRate);
    const avgResponseTime = parseInt(performance.averageResponseTime);
    const slowRequestRate = parseFloat(performance.slowRequestRate);
    
    console.log(`[${timestamp}] 📊 NFC Performance:`);
    console.log(`   Requests: ${performance.totalRequests}`);
    console.log(`   Success Rate: ${performance.successRate}`);
    console.log(`   Avg Response Time: ${performance.averageResponseTime}`);
    console.log(`   Slow Requests: ${performance.slowRequestRate}`);
    console.log(`   Errors: ${performance.errorCount}`);
    console.log(`   Uptime: ${performance.uptime}`);
    console.log(`   Monitor Response: ${responseTime}ms`);
    console.log('');
  }

  /**
   * Check for performance alerts
   */
  checkAlerts(performance) {
    const avgResponseTime = parseInt(performance.averageResponseTime);
    const errorRate = parseFloat(performance.successRate);
    const slowRequestRate = parseFloat(performance.slowRequestRate);
    
    // Response time alert
    if (avgResponseTime > this.alertThresholds.responseTime) {
      this.alert('High Response Time', 
        `Average response time is ${avgResponseTime}ms (threshold: ${this.alertThresholds.responseTime}ms)`);
    }
    
    // Error rate alert
    if (errorRate < (100 - this.alertThresholds.errorRate)) {
      this.alert('High Error Rate', 
        `Success rate is ${performance.successRate} (threshold: ${100 - this.alertThresholds.errorRate}%)`);
    }
    
    // Slow request rate alert
    if (slowRequestRate > this.alertThresholds.slowRequestRate) {
      this.alert('High Slow Request Rate', 
        `Slow request rate is ${performance.slowRequestRate}% (threshold: ${this.alertThresholds.slowRequestRate}%)`);
    }
  }

  /**
   * Send alert
   */
  alert(type, message) {
    const alert = {
      type,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.metrics.alerts.push(alert);
    
    console.log(`🚨 ALERT: ${type}`);
    console.log(`   ${message}`);
    console.log(`   Time: ${alert.timestamp}`);
    console.log('');
  }

  /**
   * Get monitoring summary
   */
  getSummary() {
    const uptime = process.uptime();
    const successRate = this.metrics.checks > 0 
      ? (((this.metrics.checks - this.metrics.failures) / this.metrics.checks) * 100).toFixed(1)
      : 0;
    
    return {
      uptime: `${Math.round(uptime)}s`,
      checks: this.metrics.checks,
      failures: this.metrics.failures,
      successRate: `${successRate}%`,
      alerts: this.metrics.alerts.length,
      recentAlerts: this.metrics.alerts.slice(-5)
    };
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
  const monitor = new NFCPerformanceMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down monitor...');
    monitor.stop();
    
    const summary = monitor.getSummary();
    console.log('\n📊 Monitoring Summary:');
    console.log(`   Uptime: ${summary.uptime}`);
    console.log(`   Checks: ${summary.checks}`);
    console.log(`   Failures: ${summary.failures}`);
    console.log(`   Success Rate: ${summary.successRate}`);
    console.log(`   Alerts: ${summary.alerts}`);
    
    if (summary.recentAlerts.length > 0) {
      console.log('\n🚨 Recent Alerts:');
      summary.recentAlerts.forEach(alert => {
        console.log(`   [${alert.timestamp}] ${alert.type}: ${alert.message}`);
      });
    }
    
    process.exit(0);
  });
  
  // Start monitoring
  monitor.start();
}

module.exports = NFCPerformanceMonitor;
