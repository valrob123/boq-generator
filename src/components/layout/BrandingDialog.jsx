import React, { useRef } from 'react';
import { X, ImagePlus, Trash2 } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useNotification } from '../../context/NotificationContext';

const MAX_LOGO_BYTES = 1.5 * 1024 * 1024; // 1.5MB

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Modal for managing company branding (logo + name) used on the document
 * header and exports.
 */
export default function BrandingDialog({ open, onClose }) {
  const { companyLogo, companyName, setCompanyLogo, setCompanyName } = useSettings();
  const { notify } = useNotification();
  const fileRef = useRef(null);

  if (!open) return null;

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file (PNG, JPG, or SVG).', 'warning');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      notify('Logo is too large. Please use an image under 1.5 MB.', 'warning');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setCompanyLogo(dataUrl);
    } catch (err) {
      notify(err.message || 'Could not load the image.', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Company branding"
      >
        <div className="modal__head">
          <h3>Company Branding</h3>
          <button type="button" className="btn-action" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <p className="modal__note">
          The logo and name appear on the BOQ header and exported documents.
        </p>

        <label className="form-group" style={{ marginBottom: '18px' }}>
          <span>Company / Agency Name</span>
          <input
            type="text"
            value={companyName}
            placeholder="e.g. DOH-CEREID"
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </label>

        <div className="branding-logo">
          {companyLogo ? (
            <img className="branding-logo__preview" src={companyLogo} alt="Logo preview" />
          ) : (
            <span className="branding-logo__empty">No logo set</span>
          )}
          <div className="branding-logo__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={16} />
              Upload
            </button>
            {companyLogo && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCompanyLogo('')}
              >
                <Trash2 size={16} />
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            style={{ display: 'none' }}
          />
        </div>

        <button
          type="button"
          className="btn btn-success"
          style={{ width: '100%', justifyContent: 'center', marginTop: '18px' }}
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
