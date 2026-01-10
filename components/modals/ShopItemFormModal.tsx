import React, { useState, useEffect } from 'react';
// FIX: Corrected import path for type definitions.
import type { ShopItem, ShopCategory } from '../../types';

interface ShopItemFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Omit<ShopItem, 'id'>) => void;
    itemToEdit: { item: ShopItem | null, category?: string };
    categories: ShopCategory[];
}

export const ShopItemFormModal = ({ isOpen, onClose, onSave, itemToEdit, categories }: ShopItemFormModalProps) => {
    const [formData, setFormData] = useState({
        name: '',
        price: 50,
        category: categories[0] || '기타',
    });

    useEffect(() => {
        if (itemToEdit.item) {
            setFormData({
                name: itemToEdit.item.name,
                price: itemToEdit.item.price,
                category: itemToEdit.item.category,
            });
        } else {
            setFormData({ 
                name: '', 
                price: 50, 
                category: itemToEdit.category || categories[0] || '기타' 
            });
        }
    }, [itemToEdit, isOpen, categories]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' ? parseInt(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{itemToEdit.item ? '상품 수정' : '새 상품 추가'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">상품명</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="예: 컵라면" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="price">가격 (스톤)</label>
                        <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} min="1" required placeholder="100" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="category">카테고리</label>
                        <select id="category" name="category" value={formData.category} onChange={handleChange}>
                           {categories.map(cat => (
                               <option key={cat} value={cat}>{cat}</option>
                           ))}
                        </select>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>취소</button>
                        <button type="submit" className="btn primary">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
};