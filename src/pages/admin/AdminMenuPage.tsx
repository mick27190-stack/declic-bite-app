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

export default function AdminMenuPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canManageMenu, loading: adminLoading } = useAdmin();
  
  const [pizzaList, setPizzaList] = useState<Pizza[]>(initialPizzas);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPizza, setEditingPizza] = useState<Pizza | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ingredients: '',
    category: 'classiques',
    isAvailable: true
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
      setFormData({
        name: pizza.name,
        description: pizza.description,
        ingredients: pizza.ingredients.join(', '),
        category: pizza.category,
        isAvailable: pizza.isAvailable
      });
    } else {
      setEditingPizza(null);
      setFormData({
        name: '',
        description: '',
        ingredients: '',
        category: 'classiques',
        isAvailable: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleSavePizza = () => {
    if (!formData.name || !formData.ingredients) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const newPizza: Pizza = {
      id: editingPizza?.id || `pizza-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      ingredients: formData.ingredients.split(',').map(i => i.trim()),
      image: editingPizza?.image || '/placeholder.svg',
      basePrice: 13, // Prix Senior par défaut
      category: formData.category as 'classiques' | 'gourmandes' | 'speciales' | 'vegetariennes',
      isAvailable: formData.isAvailable
    };

    if (editingPizza) {
      setPizzaList(prev => prev.map(p => p.id === editingPizza.id ? newPizza : p));
      toast.success('Pizza modifiée avec succès');
    } else {
      setPizzaList(prev => [...prev, newPizza]);
      toast.success('Pizza ajoutée avec succès');
    }

    setIsDialogOpen(false);
  };

  const handleDeletePizza = (id: string) => {
    setPizzaList(prev => prev.filter(p => p.id !== id));
    toast.success('Pizza supprimée');
  };

  const handleToggleAvailability = (id: string) => {
    setPizzaList(prev => prev.map(p => 
      p.id === id ? { ...p, isAvailable: !p.isAvailable } : p
    ));
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
                  <TableHead>Disponible</TableHead>
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
                        checked={pizza.isAvailable}
                        onCheckedChange={() => handleToggleAvailability(pizza.id)}
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
          <DialogContent className="max-w-md">
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
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Margherita"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="La classique italienne..."
                />
              </div>
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
              <Button onClick={handleSavePizza}>
                {editingPizza ? 'Modifier' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
