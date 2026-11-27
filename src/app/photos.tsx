import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelestialBackdrop } from '@/components/CelestialBackdrop';
import { CelestialButton } from '@/components/CelestialButton';
import { CelestialCard } from '@/components/CelestialCard';
import { LanguageToggle } from '@/components/LanguageToggle';
import { OrbitBadge } from '@/components/OrbitBadge';
import { useAuth } from '@/features/auth/AuthContext';
import { useCouple } from '@/features/couple/CoupleContext';
import { formatFileSize } from '@/features/photos/photoLogic';
import {
  MAX_PHOTO_PICK_SELECTION,
  type PhotoLibraryItem,
} from '@/features/photos/types';
import {
  usePhotoLibrary,
  type SelectedPhotoAsset,
} from '@/features/photos/usePhotoLibrary';
import { getAppLanguage, setAppLanguage, type AppLanguage } from '@/i18n';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

export default function PhotoLibraryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isConfigured } = useAuth();
  const { snapshot } = useCouple();
  const {
    status,
    photos,
    errorKey: loadErrorKey,
    uploadProgress,
    deletingPath,
    refresh,
    uploadAssets,
    deletePhoto,
  } = usePhotoLibrary();

  const currentLanguage: AppLanguage = getAppLanguage();
  const couple = snapshot?.couple ?? null;

  const [selectedPhoto, setSelectedPhoto] = useState<PhotoLibraryItem | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [retryAssets, setRetryAssets] = useState<readonly SelectedPhotoAsset[] | null>(null);

  const handleSelectLanguage = useCallback(
    (language: AppLanguage) => {
      if (language !== i18n.language) {
        void setAppLanguage(language);
      }
    },
    [i18n.language],
  );

  const handleBackHome = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const runUpload = useCallback(
    async (assets: readonly SelectedPhotoAsset[]) => {
      setActionError(null);
      setActionSuccess(null);
      setRetryAssets(null);

      const summary = await uploadAssets(assets);

      if (summary.failedCount === 0 && summary.uploadedCount > 0) {
        setActionSuccess(
          summary.uploadedCount === 1
            ? t('photos.uploadSuccessSingle')
            : t('photos.uploadSuccessMultiple', { count: summary.uploadedCount }),
        );
        return;
      }

      if (summary.failedCount > 0) {
        const reason = t(`photos.errors.${summary.firstErrorKey ?? 'unknown'}`);
        if (summary.uploadedCount > 0) {
          setActionError(
            t('photos.uploadPartialError', {
              uploaded: summary.uploadedCount,
              failed: summary.failedCount,
              reason,
            }),
          );
        } else {
          setActionError(reason);
        }
        setRetryAssets(assets);
      }
    },
    [t, uploadAssets],
  );

  const handlePickPhotos = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);

    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setActionError(t('photos.errors.permissionDenied'));
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTO_PICK_SELECTION,
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const assets: SelectedPhotoAsset[] = result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
    }));

    await runUpload(assets);
  }, [runUpload, t]);

  const handleOpenPreview = useCallback((photo: PhotoLibraryItem) => {
    setConfirmingDelete(false);
    setSelectedPhoto(photo);
  }, []);

  const handleClosePreview = useCallback(() => {
    if (deletingPath) {
      return;
    }
    setConfirmingDelete(false);
    setSelectedPhoto(null);
  }, [deletingPath]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedPhoto) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    const result = await deletePhoto(selectedPhoto.path);
    if (result.ok) {
      setConfirmingDelete(false);
      setSelectedPhoto(null);
      setActionSuccess(t('photos.deleteSuccess'));
    } else {
      setConfirmingDelete(false);
      setActionError(t(`photos.errors.${result.errorKey}`));
    }
  }, [deletePhoto, selectedPhoto, t]);

  const formatCreatedDate = (iso: string) => {
    if (!iso) {
      return '';
    }
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
  };

  const isUploading = uploadProgress !== null;

  return (
    <View style={styles.root}>
      <CelestialBackdrop />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerColumn}>
            <View style={styles.topBar}>
              <View style={styles.topActions}>
                <Pressable
                  onPress={handleBackHome}
                  accessibilityRole="button"
                  accessibilityLabel={t('photos.backAccessibility')}
                  style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
                >
                  <Text style={styles.pillButtonText}>← {t('photos.backLabel')}</Text>
                </Pressable>

                {isConfigured && couple ? (
                  <Pressable
                    onPress={() => void refresh()}
                    disabled={status === 'loading' || isUploading}
                    accessibilityRole="button"
                    accessibilityLabel={t('photos.refreshAccessibility')}
                    style={({ pressed }) => [
                      styles.pillButton,
                      (status === 'loading' || isUploading) && styles.disabledPill,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.pillButtonText}>↻ {t('photos.refreshLabel')}</Text>
                  </Pressable>
                ) : null}
              </View>

              <LanguageToggle
                currentLanguage={currentLanguage}
                onSelectLanguage={handleSelectLanguage}
                groupAccessibilityLabel={t('language.groupLabel')}
              />
            </View>

            <View style={styles.header}>
              <OrbitBadge label={t('photos.badge')} tone="subtle" />
              <Text style={styles.title} accessibilityRole="header">
                {t('photos.title')}
              </Text>
              <Text style={styles.subtitle}>{t('photos.subtitle')}</Text>
              {couple && status === 'loaded' ? (
                <Text style={styles.countText}>
                  {t('photos.countLabel', { count: photos.length })}
                </Text>
              ) : null}
            </View>

            {actionError ? (
              <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{actionError}</Text>
                {retryAssets ? (
                  <CelestialButton
                    label={t('photos.retryUploadLabel')}
                    onPress={() => void runUpload(retryAssets)}
                    loading={isUploading}
                    variant="secondary"
                    style={styles.retryButton}
                  />
                ) : null}
              </View>
            ) : null}

            {actionSuccess ? (
              <View style={styles.successBanner} accessibilityLiveRegion="polite">
                <Text style={styles.successText}>{actionSuccess}</Text>
              </View>
            ) : null}

            {!isConfigured ? (
              <CelestialCard highlighted style={styles.card}>
                <Text style={styles.cardTitle}>{t('photos.unconfigured.title')}</Text>
                <Text style={styles.cardBody}>{t('photos.unconfigured.body')}</Text>
                <CelestialButton
                  label={t('photos.backLabel')}
                  onPress={handleBackHome}
                  variant="secondary"
                />
              </CelestialCard>
            ) : !couple ? (
              <CelestialCard highlighted style={styles.card}>
                <Text style={styles.cardTitle}>{t('photos.noCouple.title')}</Text>
                <Text style={styles.cardBody}>{t('photos.noCouple.body')}</Text>
                <CelestialButton
                  label={t('photos.noCouple.action')}
                  onPress={() => router.replace('/couple')}
                  variant="primary"
                />
              </CelestialCard>
            ) : (
              <View style={styles.contentStack}>
                <CelestialButton
                  label={
                    uploadProgress
                      ? t('photos.uploadingProgress', {
                          current: uploadProgress.current,
                          total: uploadProgress.total,
                        })
                      : t('photos.addPhotos')
                  }
                  onPress={() => void handlePickPhotos()}
                  loading={isUploading}
                  disabled={Boolean(deletingPath)}
                  accessibilityLabel={t('photos.addPhotosAccessibility')}
                  variant="primary"
                />

                {uploadProgress ? (
                  <View style={styles.progressNotice} accessibilityLiveRegion="polite">
                    <ActivityIndicator size="small" color={colors.accent.starlight} />
                    <Text style={styles.progressText}>
                      {t('photos.uploadingProgress', {
                        current: uploadProgress.current,
                        total: uploadProgress.total,
                      })}
                    </Text>
                  </View>
                ) : null}

                {status === 'loading' && photos.length === 0 ? (
                  <CelestialCard style={styles.centerCard}>
                    <ActivityIndicator size="large" color={colors.accent.starlight} />
                    <Text style={styles.cardBody}>{t('photos.loading')}</Text>
                  </CelestialCard>
                ) : status === 'error' && photos.length === 0 ? (
                  <CelestialCard style={styles.card}>
                    <Text style={styles.cardTitle}>{t('photos.loadErrorTitle')}</Text>
                    <Text style={styles.errorText}>
                      {t(`photos.errors.${loadErrorKey ?? 'unknown'}`)}
                    </Text>
                    <CelestialButton
                      label={t('photos.retryLabel')}
                      onPress={() => void refresh()}
                      variant="secondary"
                    />
                  </CelestialCard>
                ) : photos.length === 0 ? (
                  <CelestialCard highlighted style={styles.card}>
                    <Text style={styles.cardTitle}>{t('photos.empty.title')}</Text>
                    <Text style={styles.cardBody}>{t('photos.empty.body')}</Text>
                  </CelestialCard>
                ) : (
                  <View style={styles.grid}>
                    {photos.map((photo, index) => (
                      <View key={photo.path} style={styles.gridCell}>
                        <Pressable
                          onPress={() => handleOpenPreview(photo)}
                          accessibilityRole="button"
                          accessibilityLabel={t('photos.tileAccessibility', {
                            index: index + 1,
                          })}
                          accessibilityHint={t('photos.tileHint')}
                          style={({ pressed }) => [
                            styles.tile,
                            pressed && styles.tilePressed,
                          ]}
                        >
                          <Image
                            source={{ uri: photo.signedUrl }}
                            style={styles.tileImage}
                            resizeMode="cover"
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={selectedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClosePreview}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
            <View style={styles.modalColumn}>
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={handleClosePreview}
                  disabled={Boolean(deletingPath)}
                  accessibilityRole="button"
                  accessibilityLabel={t('photos.preview.closeAccessibility')}
                  style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
                >
                  <Text style={styles.pillButtonText}>✕ {t('photos.preview.closeLabel')}</Text>
                </Pressable>
              </View>

              {selectedPhoto ? (
                <View style={styles.previewFrame}>
                  <Image
                    source={{ uri: selectedPhoto.signedUrl }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </View>
              ) : null}

              {selectedPhoto ? (
                <View style={styles.modalFooter}>
                  <Text style={styles.previewMeta}>
                    {[
                      formatCreatedDate(selectedPhoto.createdAt),
                      formatFileSize(selectedPhoto.sizeBytes),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>

                  {confirmingDelete ? (
                    <CelestialCard highlighted style={styles.confirmCard}>
                      <Text style={styles.cardTitle}>
                        {t('photos.preview.confirmTitle')}
                      </Text>
                      <Text style={styles.cardBody}>
                        {t('photos.preview.confirmBody')}
                      </Text>
                      <View style={styles.confirmButtons}>
                        <CelestialButton
                          label={t('photos.preview.cancelDelete')}
                          onPress={() => setConfirmingDelete(false)}
                          disabled={Boolean(deletingPath)}
                          variant="subtle"
                          style={styles.confirmButton}
                        />
                        <CelestialButton
                          label={t('photos.preview.confirmDelete')}
                          onPress={() => void handleConfirmDelete()}
                          loading={deletingPath === selectedPhoto.path}
                          variant="primary"
                          style={styles.confirmButton}
                        />
                      </View>
                    </CelestialCard>
                  ) : (
                    <CelestialButton
                      label={t('photos.preview.deleteButton')}
                      onPress={() => setConfirmingDelete(true)}
                      variant="subtle"
                    />
                  )}
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.deepSpace,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  innerColumn: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pillButton: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.pill,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledPill: {
    opacity: 0.55,
  },
  pillButtonText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  countText: {
    ...typography.caption,
    color: colors.text.accent,
  },
  contentStack: {
    gap: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
  },
  cardBody: {
    ...typography.body,
    color: colors.text.secondary,
  },
  progressNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  progressText: {
    ...typography.caption,
    color: colors.text.accent,
  },
  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(242, 167, 198, 0.5)',
    backgroundColor: 'rgba(242, 167, 198, 0.12)',
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.accent.rose,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  successBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.accent,
    backgroundColor: colors.surface.pillActive,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successText: {
    ...typography.caption,
    color: colors.text.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  gridCell: {
    width: '33.3333%',
    padding: spacing.xs,
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  tilePressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 11, 26, 0.94)',
  },
  modalSafeArea: {
    flex: 1,
    alignItems: 'center',
  },
  modalColumn: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  previewFrame: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  modalFooter: {
    gap: spacing.md,
  },
  previewMeta: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  confirmCard: {
    gap: spacing.md,
  },
  confirmButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  confirmButton: {
    flex: 1,
    minWidth: 120,
  },
});
