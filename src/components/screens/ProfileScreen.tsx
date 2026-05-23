import { useCallback, useEffect, useState } from 'react';
import { compressImageFile } from '../../lib/image';
import { uploadStoreLogo, updateStoreProfile, fetchStoreProfile, uploadProfilePhotoToCloudinary, updateVendorProfilePhoto, getVendorProfilePhoto, deleteVendorProfilePhoto, markVendorProfileComplete } from '../../services/vendorPortal';

interface ProfileScreenProps {
  onShowToast: (msg: string) => void;
  uid?: string;
  onProfileSaved?: () => void;
}

const BUSINESS_CATEGORIES = [
  'Restaurant',
  'Fast Food',
  'Cafe',
  'Bakery',
  'Grocery Store',
  'Supermarket',
  'Pharmacy',
  'Electronics',
  'Fashion',
  'Beauty',
  'Other',
];

export function ProfileScreen({ onShowToast, uid, onProfileSaved }: ProfileScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [profileUploadProgress, setProfileUploadProgress] = useState(0);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    category: '',
    logo: '',
  });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await fetchStoreProfile();
      setFormData({
        name: String(profile.name || ''),
        description: String(profile.description || ''),
        phone: String(profile.phone || ''),
        email: String(profile.email || ''),
        address: String(profile.address || ''),
        city: String(profile.city || ''),
        state: String(profile.state || ''),
        category: String(profile.category || ''),
        logo: String(profile.logo || ''),
      });
      const savedLat = Number(profile.latitude);
      const savedLng = Number(profile.longitude);
      if (Number.isFinite(savedLat) && Number.isFinite(savedLng) && savedLat !== 0 && savedLng !== 0) {
        setLocationCoords({ latitude: savedLat, longitude: savedLng });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      onShowToast('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      onShowToast('Location is not supported by your browser');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationCoords({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        setGettingLocation(false);
        onShowToast('Location captured — save your profile to confirm it');
      },
      (error) => {
        setGettingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          onShowToast('Location access denied. Please allow location in your browser settings.');
        } else {
          onShowToast('Could not get your location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onShowToast('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onShowToast('Image must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      const compressed = await compressImageFile(file, 0.85);
      const logoUrl = await uploadStoreLogo(compressed, (progress) => {
        setUploadProgress(progress);
      });
      setFormData((prev) => ({ ...prev, logo: logoUrl }));
      onShowToast('Logo uploaded successfully!');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logo: '' }));
    onShowToast('Logo removed');
  };

  const loadProfilePhoto = useCallback(async () => {
    try {
      const photoUrl = await getVendorProfilePhoto();
      setProfilePhoto(photoUrl || null);
    } catch (error) {
      console.error('Failed to load profile photo:', error);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadProfilePhoto();
  }, [loadProfile, loadProfilePhoto]);

  const handleProfilePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onShowToast('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onShowToast('Image must be less than 5MB');
      return;
    }

    try {
      setUploadingProfile(true);
      setProfileUploadProgress(0);
      const compressed = await compressImageFile(file, 0.85);
      const cloudinaryUrl = await uploadProfilePhotoToCloudinary(compressed, (progress) => {
        setProfileUploadProgress(progress);
      });
      await updateVendorProfilePhoto(cloudinaryUrl);
      setProfilePhoto(cloudinaryUrl);
      onShowToast('Profile photo updated successfully!');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setUploadingProfile(false);
      setProfileUploadProgress(0);
    }
  };

  const handleRemoveProfilePhoto = async () => {
    try {
      await deleteVendorProfilePhoto();
      setProfilePhoto(null);
      onShowToast('Profile photo removed');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to remove photo');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      onShowToast('Store name is required');
      return;
    }
    if (!formData.phone.trim()) {
      onShowToast('Phone number is required');
      return;
    }

    try {
      setSaving(true);
      await updateStoreProfile({
        ...formData,
        ...(locationCoords ?? {}),
      });
      if (uid) {
        await markVendorProfileComplete(uid).catch(() => undefined);
      }
      onShowToast('Profile updated successfully!');
      onProfileSaved?.();
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div id="screen-profile" className="screen">
        <div className="fu" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ display: 'inline-block', width: 32, height: 32, border: '2px solid var(--or)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 16 }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="screen-profile" className="screen">
      <div className="fu">
        <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Store Profile</div>
        <div style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 24 }}>Manage your store information and branding</div>

        <div className="card" style={{ maxWidth: 500 }}>
          {/* Logo Upload */}
          <div style={{ marginBottom: 28 }}>
            <label className="lbl">Store Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 16,
                  background: formData.logo ? `url(${formData.logo}) center/cover` : 'var(--s3)',
                  border: '2px dashed var(--b2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {!formData.logo && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  id="logo-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12.5, padding: '8px 16px' }}
                  onClick={() => document.getElementById('logo-input')?.click()}
                  disabled={uploading}
                >
                  {uploading ? `Uploading ${uploadProgress}%` : formData.logo ? 'Change Logo' : 'Upload Logo'}
                </button>
                {formData.logo && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12.5, padding: '8px 12px', marginLeft: 8, color: 'var(--re)' }}
                    onClick={handleRemoveLogo}
                    disabled={uploading}
                  >
                    Remove
                  </button>
                )}
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
                  Recommended: Square image, max 5MB
                </div>
              </div>
            </div>
          </div>

          {/* Profile Picture */}
          <div style={{ marginBottom: 28 }}>
            <label className="lbl">Profile Picture</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: profilePhoto ? `url(${profilePhoto}) center/cover` : 'var(--s3)',
                  border: '2px dashed var(--b2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {!profilePhoto && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  id="profile-photo-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProfilePhotoUpload(file);
                  }}
                />
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12.5, padding: '8px 16px' }}
                  onClick={() => document.getElementById('profile-photo-input')?.click()}
                  disabled={uploadingProfile}
                >
                  {uploadingProfile ? `Uploading ${profileUploadProgress}%` : profilePhoto ? 'Change Photo' : 'Upload Photo'}
                </button>
                {profilePhoto && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12.5, padding: '8px 12px', marginLeft: 8, color: 'var(--re)' }}
                    onClick={handleRemoveProfilePhoto}
                    disabled={uploadingProfile}
                  >
                    Remove
                  </button>
                )}
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
                  Personal profile photo (max 5MB)
                </div>
              </div>
            </div>
          </div>

          {/* Store Name */}
          <div style={{ marginBottom: 20 }}>
            <label className="lbl">Store Name *</label>
            <input
              className="inp"
              type="text"
              placeholder="e.g., Tasty Kitchen"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label className="lbl">Description</label>
            <textarea
              className="inp"
              style={{ minHeight: 80, resize: 'vertical' }}
              placeholder="Tell customers about your store..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 20 }}>
            <label className="lbl">Business Category</label>
            <select
              className="inp"
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="">Select category</option>
              {BUSINESS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Contact Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label className="lbl">Phone *</label>
              <input
                className="inp"
                type="tel"
                placeholder="e.g., 08012345678"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="lbl">Email</label>
              <input
                className="inp"
                type="email"
                placeholder="e.g., store@email.com"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>

          {/* Address */}
          <div style={{ marginBottom: 20 }}>
            <label className="lbl">Address</label>
            <input
              className="inp"
              type="text"
              placeholder="Street address"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div>
              <label className="lbl">City</label>
              <input
                className="inp"
                type="text"
                placeholder="e.g., Lagos"
                value={formData.city}
                onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="lbl">State</label>
              <input
                className="inp"
                type="text"
                placeholder="e.g., Lagos State"
                value={formData.state}
                onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
              />
            </div>
          </div>

          {/* Kitchen Location */}
          <div style={{ marginBottom: 28 }}>
            <label className="lbl">Kitchen Location</label>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
              Required for delivery fee calculation. Stand at your kitchen and tap the button below.
            </div>
            {locationCoords ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '10px 14px', background: 'var(--s2)', borderRadius: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gr)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span style={{ fontSize: 12.5, color: 'var(--t2)', flex: 1 }}>
                  {locationCoords.latitude.toFixed(5)}, {locationCoords.longitude.toFixed(5)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--gr)', fontWeight: 600 }}>Set</span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--re)', marginBottom: 10, fontWeight: 500 }}>
                No location set — delivery fee cannot be calculated for your orders.
              </div>
            )}
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13, padding: '9px 16px', border: '1.5px solid var(--b2)' }}
              onClick={handleGetLocation}
              disabled={gettingLocation}
              type="button"
            >
              {gettingLocation ? (
                <>
                  <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid var(--or)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 8 }} />
                  Getting location...
                </>
              ) : locationCoords ? 'Update My Location' : 'Use My Current Location'}
            </button>
          </div>

          {/* Save Button */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
