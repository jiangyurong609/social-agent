import { useState, useEffect } from 'react'
import { CheckCircle, RefreshCw, Loader2, Smartphone } from 'lucide-react'
import { getXhsLoginQrcode, getXhsLoginStatus } from '../api/client'

export default function XhsLogin() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [pollingStatus, setPollingStatus] = useState(false)

  // Check initial login status
  useEffect(() => {
    checkLoginStatus()
  }, [])

  // Poll login status when QR code is displayed
  useEffect(() => {
    if (!qrCode || isLoggedIn) return

    setPollingStatus(true)
    const interval = setInterval(async () => {
      const result = await getXhsLoginStatus()
      if (result.success && result.data?.is_logged_in) {
        setIsLoggedIn(true)
        setUsername(result.data.username || 'User')
        setQrCode(null)
        setPollingStatus(false)
        clearInterval(interval)
      }
    }, 2000)

    // Stop polling after 2 minutes
    const timeout = setTimeout(() => {
      clearInterval(interval)
      setPollingStatus(false)
      setError('QR code expired. Please refresh.')
    }, 120000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [qrCode, isLoggedIn])

  async function checkLoginStatus() {
    const result = await getXhsLoginStatus()
    if (result.success && result.data?.is_logged_in) {
      setIsLoggedIn(true)
      setUsername(result.data.username || 'User')
    }
  }

  async function fetchQrCode() {
    setLoading(true)
    setError(null)
    setQrCode(null)

    const result = await getXhsLoginQrcode()

    if (result.success && result.data) {
      if (result.data.is_logged_in) {
        setIsLoggedIn(true)
        setLoading(false)
        return
      }
      setQrCode(result.data.img)
    } else {
      setError(result.message || 'Failed to get QR code')
    }
    setLoading(false)
  }

  if (isLoggedIn) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Already Logged In</h2>
          <p className="text-gray-500 mb-6">
            {username ? `Logged in as ${username}` : 'Your Xiaohongshu account is connected'}
          </p>
          <button
            onClick={() => setIsLoggedIn(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Switch account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Xiaohongshu Login</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {!qrCode && !loading && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Smartphone className="text-xhs-red" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Scan QR Code to Login
            </h3>
            <p className="text-gray-500 mb-6">
              Click the button below to generate a QR code, then scan it with Xiaohongshu app.
            </p>
            <button
              onClick={fetchQrCode}
              className="w-full py-3 bg-xhs-red text-white rounded-lg hover:bg-xhs-pink transition-colors font-medium"
            >
              Get QR Code
            </button>
            {error && (
              <p className="mt-4 text-sm text-red-500">{error}</p>
            )}
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin text-xhs-red mx-auto mb-4" size={48} />
            <p className="text-gray-500">
              Generating QR code...
              <br />
              <span className="text-sm">This may take up to 2 minutes</span>
            </p>
          </div>
        )}

        {qrCode && (
          <div className="text-center">
            <div className="mb-4 p-4 bg-white border-2 border-gray-200 rounded-xl inline-block">
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="Login QR Code"
                className="w-64 h-64"
              />
            </div>
            <p className="text-gray-600 mb-2">
              Open Xiaohongshu app and scan this QR code
            </p>
            {pollingStatus && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="animate-spin" size={16} />
                Waiting for scan...
              </div>
            )}
            <button
              onClick={fetchQrCode}
              className="mt-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw size={16} />
              Refresh QR Code
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-800 mb-1">Note</h4>
        <p className="text-sm text-yellow-700">
          After scanning, you may need to complete SMS verification on your phone.
          The QR code expires after 2 minutes.
        </p>
      </div>
    </div>
  )
}
