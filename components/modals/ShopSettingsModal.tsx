import React, { useState } from 'react';
import type { ShopSettings, ShopCategory, ShopItem } from '../../types';
import type { ActionButton } from './ConfirmationModal';

interface ShopSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    shopSettings: ShopSettings;
    setShopSettings: React.Dispatch<React.SetStateAction<ShopSettings>>;
    shopCategories: ShopCategory[];
    setShopCategories: React.Dispatch<React.SetStateAction<ShopCategory[]>>;
    shopItems: ShopItem[];
    setShopItems: React.Dispatch<React.SetStateAction<ShopItem[]>>;
    setConfirmation: (confirmation: { message: React.ReactNode; actions: ActionButton[] } | null) => void;
}

export const ShopSettingsModal = (props: ShopSettingsModalProps) => {
    const { 
        isOpen, onClose, shopSettings, setShopSettings, 
        shopCategories, setShopCategories, shopItems, setShopItems,
        setConfirmation
    } = props;

    const [newCategory, setNewCategory] = useState('');

    if (!isOpen) return null;

    const handleAddCategory = () => {
        const trimmedCategory = newCategory.trim();
        if (trimmedCategory && !shopCategories.includes(trimmedCategory)) {
            setShopCategories([...shopCategories, trimmedCategory]);
            setNewCategory('');
        } else {
            alert('카테고리 이름이 비어있거나 이미 존재합니다.');
        }
    };

    const handleEditCategory = (oldCategory: string) => {
        const newName = prompt(`'${oldCategory}'의 새 이름을 입력하세요:`, oldCategory);
        if (newName && newName.trim() && newName.trim() !== oldCategory) {
            if (shopCategories.includes(newName.trim())) {
                alert('이미 존재하는 카테고리 이름입니다.');
                return;
            }
            setShopCategories(shopCategories.map(c => c === oldCategory ? newName.trim() : c));
            setShopItems(prevItems => 
                prevItems.map(item => 
                    item.category === oldCategory ? { ...item, category: newName.trim() } : item
                )
            );
        }
    };

    const handleDeleteCategory = (categoryToDelete: string) => {
        const isCategoryInUse = shopItems.some(item => item.category === categoryToDelete);
        if (isCategoryInUse) {
            alert('이 카테고리를 사용하는 상품이 있어 삭제할 수 없습니다.');
            return;
        }
        setConfirmation({
            message: `'${categoryToDelete}' 카테고리를 정말 삭제하시겠습니까?`,
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '삭제', className: 'danger', onClick: () => {
                    setShopCategories(shopCategories.filter(c => c !== categoryToDelete));
                    setConfirmation(null);
                }}
            ]
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>상점 설정</h2>
                <div className="modal-body">
                    <div className="settings-form-section">
                        <h3>할인 설정</h3>
                        <div className="settings-form-row">
                            <div className="label-group">
                                <label htmlFor="bulk-discount">묶음 구매 할인</label>
                                <p>학생이 한 번에 2개 이상의 상품을 구매할 때 적용되는 할인율입니다.</p>
                            </div>
                            <div className="input-group">
                                <input
                                    type="number"
                                    id="bulk-discount"
                                    value={shopSettings.bulkPurchaseDiscountRate}
                                    onChange={(e) => setShopSettings({ ...shopSettings, bulkPurchaseDiscountRate: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    max="100"
                                    placeholder="0"
                                />
                                <span>%</span>
                            </div>
                        </div>
                    </div>

                    <div className="settings-form-section">
                        <h3>카테고리 설정</h3>
                        <div className="item-list" style={{gridTemplateColumns: '1fr', gap: '0.5rem'}}>
                            {shopCategories.map(cat => (
                                <div key={cat} className="item-card" style={{padding: '0.75rem'}}>
                                    <p style={{margin: 0}}>{cat}</p>
                                    <div className="item-actions">
                                        <button className="btn-sm" onClick={() => handleEditCategory(cat)}>수정</button>
                                        <button className="btn-sm danger" onClick={() => handleDeleteCategory(cat)}>삭제</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="form-group inline-group" style={{marginTop: '1rem'}}>
                            <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="새 카테고리 이름" />
                            <button className="btn primary" onClick={handleAddCategory}>추가</button>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn primary" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
};