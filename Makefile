.PHONY: up down logs shell migrate superuser test seed fmt

up:
	docker compose up --build -d
	docker compose exec backend python manage.py migrate

down:
	docker compose down

logs:
	docker compose logs -f --tail=200 backend

shell:
	docker compose exec backend python manage.py shell_plus || docker compose exec backend python manage.py shell

migrate:
	docker compose exec backend python manage.py makemigrations
	docker compose exec backend python manage.py migrate

superuser:
	docker compose exec backend python manage.py createsuperuser --email admin@example.com --username admin

seed:
	docker compose exec backend python manage.py shell -c "from core.models import Contact; [Contact.objects.get_or_create(first_name='John', last_name='Doe', email=f'john{i}@ex.com', phone='555-000') for i in range(3)]"

test:
	docker compose exec backend pytest
