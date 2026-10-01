export function openPackagePhotoPicker(fileInput) {
  const ios = window.webkit?.messageHandlers?.pickPhoto;
  if (ios) {
    ios.postMessage('image');
    return;
  }
  if (window.RentadosNative?.pickPackagePhoto) {
    window.RentadosNative.pickPackagePhoto();
    return;
  }
  fileInput?.click();
}

export function bindNativePackagePhoto(onFile) {
  window.rentadosApplyPickedPhoto = async (dataUrl) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'paquete.jpg', { type: blob.type || 'image/jpeg' });
    onFile(file);
  };
  return () => {
    delete window.rentadosApplyPickedPhoto;
  };
}
