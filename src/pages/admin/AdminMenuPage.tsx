import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Image } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pizzas as initialPizzas, categories } from '@/data/pizzas';
import { Pizza } from '@/types/pizza';
import { useEffect } from 'react';
import { useMenuAvailability } from '@/hooks/useMenuAvailability';
import { useMenuOverrides, applyOverride } from '@/hooks/useMenuOverrides';
import { fileToCompressedDataUrl } from '@/lib/imageResize';

const CAPACITY_OPTIONS = ['0,25L', '0,33L', '0,5L', '0,75L', '1L', '1,25L', '1,5L', '1,75L', '2L'];
const PIZZA_CATEGORIES = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'];

export default function AdminMenuPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canManageMenu, loading: adminLoading } = useAdmin();
  const { isAvailable, setAvailable } = useMenuAvailability();
  const { overrides, customPizzas, upsert, removeCustom } = useMenuOverrides();

  const pizzaList: Pizza[] = [
    ...initialPizzas.map((p) => applyOverride(p, overrides[p.id])),
    ...customPizzas,
  ];
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPizza, setEditingPizza] = useState<Pizza | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ingredients: '',
    category: 'classiques',
    capacity: '',
    isAvailable: true,
    image: '',
    basePrice: '',
  });


  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!canManageMenu) {
        navigate('/admin');
      }
    }
  }, [user, canManageMenu, authLoading, adminLoading]);

  const handleOpenDialog = (pizza?: Pizza) => {
    if (pizza) {
      setEditingPizza(pizza);
      const isDrink = pizza.category === 'boissons';
      setFormData({
        name: pizza.name,
        description: isDrink ? '' : pizza.description,
        ingredients: pizza.ingredients.join(', '),
        category: pizza.category,
        capacity: isDrink ? (pizza.description || '') : '',
        isAvailable: pizza.isAvailable,
        image: pizza.image ?? '',
        basePrice: pizza.basePrice ? String(pizza.basePrice) : '',
      });
    } else {
      setEditingPizza(null);
      setFormData({
        name: '',
        description: '',
        ingredients: '',
        category: 'classiques',
        capacity: '',
        isAvailable: true,
        image: '',
        basePrice: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handlePickImage = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner un fichier image');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setFormData((prev) => ({ ...prev, image: dataUrl }));
      toast.success('Photo chargée');
    } catch (e: any) {
      toast.error(e.message || "Impossible de charger l'image");
    } finally {
      setUploading(false);
    }
  };

  const isCustom = (id: string) => Boolean(overrides[id]?.is_custom);

  const handleSavePizza = async () => {
    if (!formData.name || !formData.ingredients) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    const creating = !editingPizza;


    const itemId = editingPizza
      ? editingPizza.id
      : `custom-${formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()
          .toString(36)
          .slice(-4)}`;

    const priceValue = parseFloat(formData.basePrice.replace(',', '.'));
    const isPizzaCat = PIZZA_CATEGORIES.includes(formData.category);

    setSaving(true);
    try {
      await upsert({
        item_id: itemId,
        name: formData.name,
        description: formData.category === 'boissons' ? null : formData.description,
        ingredients: formData.ingredients.split(',').map((i) => i.trim()).filter(Boolean),
        category: formData.category,
        capacity: formData.category === 'boissons' ? (formData.capacity || null) : null,
        image_url: formData.image || null,
        base_price: !isPizzaCat && !isNaN(priceValue) ? priceValue : undefined,
        ...(creating ? { is_custom: true } : {}),
      });
      toast.success(creating ? 'Produit ajouté au menu' : 'Produit mis à jour');
      setIsDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePizza = async (id: string) => {
    if (!isCustom(id)) {
      toast.info("La suppression définitive n'est pas disponible. Désactivez le produit à la place.");
      return;
    }
    if (!window.confirm('Supprimer définitivement ce produit du menu ?')) return;
    try {
      await removeCustom(id);
      toast.success('Produit supprimé');
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la suppression');
    }
  };



  const handleToggleAvailability = async (id: string, site: 'conches' | 'beaumont') => {
    try {
      await setAvailable(id, site, !isAvailable(id, site));
    } catch (e) {
      toast.error("Impossible de mettre à jour la disponibilité");
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-primary">Gestion du Menu</h1>
            <p className="text-sm text-muted-foreground">Ajouter, modifier ou supprimer des pizzas</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pizzas ({pizzaList.length})</CardTitle>
              <CardDescription>
                Gérez votre menu de pizzas
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une pizza
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Ingrédients</TableHead>
                  <TableHead>Disponible Conches</TableHead>
                  <TableHead>Disponible Beaumont</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pizzaList.map((pizza) => (
                  <TableRow key={pizza.id}>
                    <TableCell>
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-muted">
                        <img 
                          src={pizza.image} 
                          alt={pizza.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{pizza.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {categories.find(c => c.id === pizza.category)?.emoji} {pizza.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {pizza.ingredients.join(', ')}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={isAvailable(pizza.id, 'conches')}
                        onCheckedChange={() => handleToggleAvailability(pizza.id, 'conches')}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={isAvailable(pizza.id, 'beaumont')}
                        onCheckedChange={() => handleToggleAvailability(pizza.id, 'beaumont')}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(pizza)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeletePizza(pizza.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPizza ? 'Modifier la pizza' : 'Ajouter une pizza'}
              </DialogTitle>
              <DialogDescription>
                {editingPizza ? 'Modifiez les informations de la pizza' : 'Entrez les informations de la nouvelle pizza'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="photo">Photo {editingPizza ? '' : '*'}</Label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                    {formData.image ? (
                      <img src={formData.image} alt="Aperçu du produit" className="w-full h-full object-cover" />
                    ) : (
                      <Image className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePickImage(e.target.files?.[0])}
                    />
                    <p className="text-xs text-muted-foreground">
                      {uploading ? 'Chargement…' : 'JPG ou PNG — redimensionnée automatiquement'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Margherita"
                />
              </div>

              {formData.category === 'boissons' ? (
                <div className="space-y-2">
                  <Label htmlFor="capacity">Contenance</Label>
                  <Select
                    value={formData.capacity}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, capacity: v }))}
                  >
                    <SelectTrigger id="capacity">
                      <SelectValue placeholder="Choisir une contenance" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPACITY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="La classique italienne..."
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="ingredients">Ingrédients * (séparés par des virgules)</Label>
                <Textarea
                  id="ingredients"
                  value={formData.ingredients}
                  onChange={(e) => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
                  placeholder="Tomate, Mozzarella, Basilic"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!PIZZA_CATEGORIES.includes(formData.category) && (
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Prix (€)</Label>
                  <Input
                    id="basePrice"
                    inputMode="decimal"
                    value={formData.basePrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, basePrice: e.target.value }))}
                    placeholder="5,50"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isAvailable}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAvailable: checked }))}
                />
                <Label>Disponible à la vente</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSavePizza} disabled={saving || uploading}>
                {editingPizza ? 'Modifier' : 'Ajouter'}
              </Button>

            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
