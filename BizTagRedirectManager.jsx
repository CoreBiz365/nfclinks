import React, { useState, useEffect } from 'react';

const BizTagRedirectManager = ({ bizcode, onUpdate }) => {
  const [biztag, setBiztag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Load BizTag details
  useEffect(() => {
    if (bizcode) {
      loadBizTag();
    }
  }, [bizcode]);

  const loadBizTag = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nfc/tags/${bizcode}`);
      const data = await response.json();
      
      if (data.ok) {
        setBiztag(data.data);
        setRedirectUrl(data.data.redirect_url || '');
        setTitle(data.data.title || '');
        setDescription(data.data.description || '');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load BizTag details');
    } finally {
      setLoading(false);
    }
  };

  const saveRedirect = async () => {
    setSaving(true);
    setError('');
    
    try {
      const response = await fetch(`/api/nfc/tags/${bizcode}/redirect`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          redirect_url: redirectUrl.trim() || null,
          title: title.trim() || null,
          description: description.trim() || null
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        setBiztag(data.data);
        onUpdate && onUpdate(data.data);
        alert('BizTag redirect updated successfully!');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update BizTag redirect');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!confirm('Reset this BizTag to default redirect (signup page)?')) {
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const response = await fetch(`/api/nfc/tags/${bizcode}/redirect`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.ok) {
        setBiztag(data.data);
        setRedirectUrl('');
        onUpdate && onUpdate(data.data);
        alert('BizTag reset to default redirect!');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to reset BizTag redirect');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading BizTag...</span>
      </div>
    );
  }

  if (!biztag) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">BizTag not found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Manage BizTag Redirect
        </h2>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {biztag.bizcode}
          </span>
          <span className="text-gray-400">•</span>
          <span>UID: {biztag.uid}</span>
          <span className="text-gray-400">•</span>
          <span>{biztag.click_count || 0} clicks</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for this BizTag"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a description for this BizTag"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Redirect URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Redirect URL
          </label>
          <input
            type="url"
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
            placeholder="https://example.com or leave empty for default (signup page)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Leave empty to use default redirect to signup page
          </p>
        </div>

        {/* Current Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Current Status</h3>
          <div className="text-sm text-gray-600">
            <p>
              <strong>Redirect:</strong>{' '}
              {biztag.redirect_url ? (
                <span className="text-green-600">{biztag.redirect_url}</span>
              ) : (
                <span className="text-blue-600">Default (signup page)</span>
              )}
            </p>
            <p>
              <strong>QR Code:</strong>{' '}
              <a 
                href={biztag.qr_code} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {biztag.qr_code}
              </a>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={saveRedirect}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          
          <button
            onClick={resetToDefault}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
};

export default BizTagRedirectManager;
